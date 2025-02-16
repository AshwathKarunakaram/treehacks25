# whisper_app.py

import websockets
import asyncio
import json
import os
from dotenv import load_dotenv
from collections import deque
from pydantic import BaseModel
import requests
import boto3

# LangChain imports for context orchestration
from langchain.chat_models import ChatOpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

# Import API clients
from openai import OpenAI
from elevenlabs.client import ElevenLabs

#Stream Imports
from fastapi import FastAPI
from sse_starlette.sse import EventSourceResponse

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Load Environment Variables
# -----------------------------------------------------------------------------
load_dotenv()

# -----------------------------------------------------------------------------
# Pydantic Model for Perplexity Answer Format
# -----------------------------------------------------------------------------
class AnswerFormat(BaseModel):
    isTrue: str
    justification: str
    sources: str

# -----------------------------------------------------------------------------
# Initialize API Clients
# -----------------------------------------------------------------------------
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
ELclient = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "PERPLEXITY_API_KEY")
aws_access_key_id = os.getenv("aws_access_key_id","hi")
aws_secret_access_key = os.getenv("aws_secret_access_key","hi")
s3 = boto3.client("s3", aws_access_key_id=aws_access_key_id, aws_secret_access_key=aws_secret_access_key)
# aws_session_token="your-session-token"  # Include if needed

# -----------------------------------------------------------------------------
# Original Function: Query Perplexity
# -----------------------------------------------------------------------------
def query_perplexity(statement: str):
    """
    Fact-check a statement using the Perplexity Sonar API with adaptive behavior.
    The prompt instructs the API to output a JSON structure with keys: 'isTrue',
    'justification', and 'sources'.
    """
    prompt = (
        f"Determine if the following statement is 'True', 'Unknown', or 'False': '{statement}'. "
        "Give an output in the following json structure: 'isTrue', 'justification'. "
        "Respond in 'isTrue' with one word: True, Unknown, or False. "
        "In 'justification', provide fact checking if the statement is 'False' or elaboration if the statement is 'True'. If it's Unknown, don't respond. "
        "Only respond if the statement is serious and has no sign of figures of speech or casual conversation. "
        "Add sources in 'sources'."
    )
    
    url = "https://api.perplexity.ai/chat/completions"
    payload = {
        "model": "sonar",
        "messages": [
            {"role": "system", "content": "Be concise and respond conversationally."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"schema": AnswerFormat.model_json_schema()},
        },
    }
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    response = requests.post(url, headers=headers, json=payload).json()
    
    # Extract the content as a string
    content_str = response["choices"][0]["message"]["content"]
    print("\nFull Response:", content_str)

    # Extract the justification directly from the response
    justification_start = content_str.find('"justification":') + len('"justification":')
    justification_end = content_str.find(',"sources"')  # Stop at sources
    justification = content_str[justification_start:justification_end].strip().strip('"')

    true_start = content_str.find('"isTrue":') + len('"isTrue":')
    true_end = content_str.find(',"justification"')  # Stop at sources
    true_str = content_str[true_start:true_end].strip().strip('"')

    return content_str, justification, true_str

# -----------------------------------------------------------------------------
# New Endpoints: Pydantic Model for Test Perplexity
# -----------------------------------------------------------------------------
class PerplexityRequest(BaseModel):
    statement: str


# -----------------------------------------------------------------------------
# Global Context Memory & LangChain Orchestration for Context
# -----------------------------------------------------------------------------
# This deque stores transcript chunks to build an overall discussion context.
context_memory = deque(maxlen=10)

# Initialize a LangChain LLM for orchestrating context.
llm_chain_context = ChatOpenAI(
    model="gpt-4-turbo",
    temperature=0.2,
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

# Define a prompt template that combines overall context with a new transcript chunk.
context_prompt = PromptTemplate(
    input_variables=["overall_context", "current_chunk"],
    template=(
        "Below is the overall discussion context:\n{overall_context}\n\n"
        "And here is the new transcript segment:\n{current_chunk}\n\n"
        "Combine these into one enriched statement that provides context for fact-checking."
    )
)

# Create an LLMChain for context orchestration.
context_chain = LLMChain(llm=llm_chain_context, prompt=context_prompt)

def orchestrate_context(current_chunk: str) -> str:
    """
    Uses LangChain to combine the overall discussion context (from context_memory)
    with the current transcript chunk, returning an enriched statement.
    """
    overall_context = " ".join(context_memory)
    enriched_statement = context_chain.run({
        "overall_context": overall_context,
        "current_chunk": current_chunk
    })
    return enriched_statement.strip()


# -----------------------------------------------------------------------------
# ElevenLabs TTS Function
# -----------------------------------------------------------------------------
def text_to_speech(text: str) -> bytes:
    """
    Convert text to speech using the ElevenLabs API.
    Returns audio bytes.
    """
    audio = ELclient.text_to_speech.convert(
        text=text,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    # Convert the generator to bytes.
    audio_bytes = b"".join(audio)
    return audio_bytes

# -----------------------------------------------------------------------------
# Transcript Handling Function
# -----------------------------------------------------------------------------
import os
import uuid

def handle_transcript(transcript: str) -> str:
    """
    Processes a transcript chunk:
      - Adds the chunk to the overall context memory.
      - Uses LangChain to produce an enriched statement.
      - Sends the enriched statement to Perplexity for fact-checking.
      - Converts the result to speech using ElevenLabs TTS.
      - Stores the generated audio locally in /treehacks/public/test/ and returns its file path.
    """
    # Add new chunk to context memory.
    context_memory.append(transcript)
    
    # Generate an enriched statement using overall context.
    enriched_statement = orchestrate_context(transcript)
    print("Enriched Statement:", enriched_statement)
    
    # Query Perplexity with the enriched statement.
    _, justification, true = query_perplexity(enriched_statement)
    print(justification)
    audio_bytes = text_to_speech(justification)
    
    # Create a unique filename.
    unique_filename = f"response_{uuid.uuid4().hex}.mp3"
    
    # Define the folder where you'll store the audio.
    # This path assumes your working directory is at /treehacks/
    audio_folder = os.path.join("treehacks", "public", "temp")
    os.makedirs(audio_folder, exist_ok=True)
    
    # Full path to the output file.
    output_path = os.path.join(audio_folder, unique_filename)
    
    # Write the audio bytes to the file.
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    
    s3url = upload_to_s3(output_path, unique_filename, "audiotreehacks")
    print("Audio stored at:", output_path)

    # Publish the event to the SSE stream.
    # The URL is relative to the Next.js public folder. Adjust as needed.
    asyncio.create_task(publish_event({"s3url": s3url, "justification": justification, "isTrue": true}))

    return s3url

def upload_to_s3(file_path, key, bucket_name="audiotreehacks"):
    s3.upload_file(file_path, bucket_name, key)
    return f"https://{bucket_name}.s3.amazonaws.com/{key}"

# -----------------------------------------------------------------------------
# SSE: Global Event Queue and Publisher
# -----------------------------------------------------------------------------
event_queue = asyncio.Queue()

async def publish_event(event: dict):
    """
    Asynchronously publishes an event to the global SSE event queue.
    """
    await event_queue.put(event)

@app.get("/api/stream-tags")
async def sse_endpoint():
    """
    SSE endpoint that streams events from the global event queue.
    Clients connecting to this endpoint will receive events as JSON strings.
    """
    async def event_generator():
        while True:
            event = await event_queue.get()
            yield {"data": json.dumps(event)}
    return EventSourceResponse(event_generator())
        


# -----------------------------------------------------------------------------
# WebSocket Endpoint: Fetch Transcript
# -----------------------------------------------------------------------------
async def fetch_transcript():
    """
    Connects to the Zoom RTMS WebSocket and processes incoming transcript chunks.
    Only chunks with at least 5 words are processed.
    """
    uri = "ws://localhost:9092/transcript"
    print(f"Attempting to connect to {uri}...")
    async with websockets.connect(uri) as websocket:
        print(f"Connected to {uri}")
        while True:
            try:
                response = await websocket.recv()
                data = json.loads(response)
                # Adjust this based on your Zoom RTMS payload structure.
                chunk = data.get("content", {}).get("data", "")
                print(chunk)
                if chunk and len(chunk.strip().split()) >= 5:
                    print("Received chunk:", chunk)
                    handle_transcript(chunk)
                else:
                    print("Chunk too short, ignoring.")
            except websockets.exceptions.ConnectionClosed as e:
                print(f"Connection closed: {e}")
                break
            except json.JSONDecodeError as e:
                print(f"Failed to decode JSON: {e}")
            except Exception as e:
                print(f"Unexpected error: {e}")

if __name__ == "__main__":
    # For development/testing, run the WebSocket transcript fetcher.
    asyncio.run(fetch_transcript())
