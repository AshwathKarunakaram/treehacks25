# main.py

import os
from dotenv import load_dotenv
import asyncio
from collections import deque
from fastapi import FastAPI, WebSocket, UploadFile, File, Body, Response
from langchain.chat_models import ChatOpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
import chromadb
import requests
from openai import OpenAI  # Import the OpenAI client
from elevenlabs.client import ElevenLabs
from elevenlabs import play
from pydantic import BaseModel
import requests



class PerplexityRequest(BaseModel):
    statement: str

# Set your API keys in your environment variables or replace them here
# Example: export OPENAI_API_KEY="your-key"
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "hi"))
ELclient = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
# perplexityClient = client = OpenAI(api_key=os.getenv("PERPLEXITY_API_KEY", "hi"), base_url="https://api.perplexity.ai")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "YOUR_ELEVENLABS_API_KEY")
PERPLEXITY_API_KEY=os.getenv("PERPLEXITY_API_KEY", "PERPLEXITY_API_KEY")

# Initialize FastAPI app
app = FastAPI()

# Initialize LangChain components with your OpenAI API key
llm = ChatOpenAI(model="gpt-4-turbo", temperature=0.2, openai_api_key=os.getenv("OPENAI_API_KEY"))

# Sliding window for recent transcript chunks
class TranscriptMemory:
    def __init__(self, memory_size=3):
        self.memory = deque(maxlen=memory_size)

    def add_chunk(self, chunk):
        self.memory.append(chunk)

    def get_context(self):
        return " ".join(self.memory)

memory = TranscriptMemory()

# Whisper API transcription using the OpenAI client
def transcribe_audio(audio_path):
    """
    Transcribe audio file using OpenAI's Whisper via the dedicated client.
    """
    try:
        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json"
            )
        # Extract and return the transcribed text
        return transcription.text
    except Exception as e:
        print(f"Whisper Transcription Error: {e}")
        return ""

feedback_memory = {}

def detect_figure_of_speech(statement):
    # Basic heuristic for detecting hyperbole
    hyperbole_keywords = ["always", "never", "forever", "literally", "everyone", "nobody", "impossible"]
    return any(word.lower() in statement.lower() for word in hyperbole_keywords)

def query_perplexity(statement):
    """
    Fact-check a statement using the Perplexity Sonar API with adaptive behavior for figures of speech.
    """

    # Check if statement is flagged as hyperbole
    if detect_figure_of_speech(statement) or statement in feedback_memory:
        return "This sounds like hyperbole or a figure of speech. No need to fact-check it!"

    # Construct the prompt with awareness for figures of speech
    prompt = (
        f"Determine if the following statement is true, false, or partially true: '{statement}'. "
        "If the statement appears to be a figure of speech or hyperbole, respond with a lighthearted comment instead of fact-checking."
    )
    
    url = "https://api.perplexity.ai/chat/completions"

    payload = {
        "model": "sonar",
        "messages": [
            {
                "role": "system",
                "content": "Be concise. Identify hyperbole and respond playfully if needed."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 200,
        "temperature": 0.3,
        "top_p": 0.85,
        "search_domain_filter": None,
        "return_images": False,
        "return_related_questions": False,
        "search_recency_filter": "year",
        "top_k": 0,
        "stream": False,
        "presence_penalty": 0,
        "frequency_penalty": 0.5,
        "response_format": None
    }

    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)
    result = response.json().get("choices")[0]["message"]["content"]

    # Check if response was irrelevant and log it
    if "unnecessary" in result.lower() or "irrelevant" in result.lower():
        feedback_memory[statement] = "Ignore"
        print(f"Learning: '{statement}' flagged for ignoring future responses.")
        
    return result

# ChromaDB: Retrieve company context
chromadb_client = chromadb.PersistentClient()
collection = chromadb_client.get_or_create_collection("company_knowledge")

def retrieve_company_context(statement):
    """
    Fetch relevant company knowledge for additional insights.
    """
    results = collection.query(query_texts=[statement], n_results=3)
    return results["documents"] if results.get("documents") else []

# LLM Decision Chain
decision_prompt = PromptTemplate(
    input_variables=["statement", "perplexity_answer", "sources", "company_context"],
    template="""
    Given the following external sources:
    {sources}

    And Perplexity's answer:
    "{perplexity_answer}"

    And relevant company knowledge:
    {company_context}

    Decide the action:
    - If the statement is wrong, respond with ONLY "CORRECT".
    - If the statement is right but can be expanded, respond with ONLY "EXPAND".
    - If nothing should be done, respond with ONLY "IGNORE".
    """
)

decision_chain = LLMChain(llm=llm, prompt=decision_prompt)

# ElevenLabs Text-to-Speech (using requests)
def text_to_speech(text):
    """
    Convert text to speech using the ElevenLabs API.
    """

    audio = ELclient.text_to_speech.convert(
    text=text,
    voice_id="JBFqnCBsd6RMkjVDRZzb",
    model_id="eleven_multilingual_v2",
    output_format="mp3_44100_128",)
    
    audio_bytes = b"".join(audio)
    return audio_bytes# Decision Function: Determine whether to CORRECT, EXPAND, or IGNORE
def decide_action(statement):
    """
    Determines whether to interject (CORRECT), chime in (EXPAND), or do nothing (IGNORE).
    """
    perplexity_results = query_perplexity(statement)
    company_context = retrieve_company_context(statement)

    decision = decision_chain.run({
        "statement": statement,
        "perplexity_answer": perplexity_results.get("answer", "Unknown"),
        "sources": perplexity_results.get("sources", []),
        "company_context": company_context
    }).strip()

    return decision, perplexity_results.get("sources", []), company_context

# Handle Transcript Processing
def handle_transcript(transcript):
    """
    Processes the transcript and triggers the appropriate Persona actions.
    """
    memory.add_chunk(transcript)
    recent_context = memory.get_context()

    action, sources, company_context = decide_action(recent_context)

    if action == "CORRECT":
        message = f"Actually, that's incorrect. Here's why: {sources}"
        text_to_speech(message)
        print(f"🚨 INTERJECT: {message}")
    elif action == "EXPAND":
        message = f"Great point! Additionally, did you know: {company_context}?"
        text_to_speech(message)
        print(f"💡 CHIME IN: {message}")
    else:
        print("✅ No action needed.")

# HTTP POST endpoint for testing transcription with an uploaded audio file
@app.post("/test-transcription")
async def test_transcription(file: UploadFile = File(...)):
    """
    Receives an audio file, transcribes it, and runs the Persona AI pipeline.
    """
    try:
        temp_audio_path = f"temp_{file.filename}"
        with open(temp_audio_path, "wb") as f:
            f.write(await file.read())

        transcript = transcribe_audio(temp_audio_path)
        print(f"📥 Received Test Transcript: {transcript}")
        handle_transcript(transcript)

        return {"status": "success", "transcript": transcript}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    

@app.post("/test-tts")
async def test_tts_endpoint(payload: dict = Body(...)):
    """
    Receives a JSON payload with 'text', generates speech using ElevenLabs,
    and returns the audio as an 'audio/mpeg' response.
    """
    text = payload.get("text", "")
    if not text:
        return {"error": "No text provided."}
    
    audio_data = text_to_speech(text)
    if audio_data is None:
        return {"error": "Failed to generate audio."}
    
    # Return the binary audio data with the appropriate media type.
    return Response(content=audio_data, media_type="audio/mpeg")

@app.post("/test-perplexity")
async def test_perplexity_endpoint(payload: PerplexityRequest):
    """
    Receives a JSON payload with a 'statement', queries the Perplexity API,
    and returns the result.
    """
    result = query_perplexity(payload.statement)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="info")
