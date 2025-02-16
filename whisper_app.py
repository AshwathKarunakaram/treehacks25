# whisper_app.py

import asyncio
import json
import os
import uuid
import requests
import boto3
import websockets
from collections import deque
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from pydantic import BaseModel
import uvicorn

# LangChain and API Clients
from langchain.chat_models import ChatOpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from openai import OpenAI
from elevenlabs.client import ElevenLabs

# SSE and FastAPI imports
from sse_starlette.sse import EventSourceResponse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# -----------------------------------------------------------------------------
# Load Environment Variables
# -----------------------------------------------------------------------------
load_dotenv()

# -----------------------------------------------------------------------------
# Define Lifespan Context and Create the FastAPI App
# -----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schedule the fetch_transcript task in the same event loop.
    asyncio.create_task(fetch_transcript())
    yield

app = FastAPI(lifespan=lifespan)

# -----------------------------------------------------------------------------
# Add Middleware
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Initialize API Clients and AWS S3 Client
# -----------------------------------------------------------------------------
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
ELclient = ElevenLabs(api_key="sk_ee017e30e157a7e8197b23fd015bc06f939f8e46b2161c70")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "PERPLEXITY_API_KEY")
aws_access_key_id = os.getenv("aws_access_key_id", "hi")
aws_secret_access_key = os.getenv("aws_secret_access_key", "hi")
s3 = boto3.client(
    "s3",
    aws_access_key_id=aws_access_key_id,
    aws_secret_access_key=aws_secret_access_key
)

# -----------------------------------------------------------------------------
# Define Pydantic Models
# -----------------------------------------------------------------------------
class AnswerFormat(BaseModel):
    isTrue: str
    justification: str
    sources: str

class PerplexityRequest(BaseModel):
    statement: str

# -----------------------------------------------------------------------------
# Global Context Memory and LangChain Orchestration for Context
# -----------------------------------------------------------------------------
context_memory = deque(maxlen=10)

llm_chain_context = ChatOpenAI(
    model="gpt-4-turbo",
    temperature=0.2,
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

context_prompt = PromptTemplate(
    input_variables=["overall_context", "current_chunk"],
    template=(
        "Below is the overall discussion context:\n{overall_context}\n\n"
        "And here is the new transcript segment:\n{current_chunk}\n\n"
        "Combine these into one enriched statement that provides context for fact-checking."
    )
)

context_chain = LLMChain(llm=llm_chain_context, prompt=context_prompt)

def orchestrate_context(current_chunk: str) -> str:
    overall_context = " ".join(context_memory)
    enriched_statement = context_chain.run({
        "overall_context": overall_context,
        "current_chunk": current_chunk
    })
    return enriched_statement.strip()

# -----------------------------------------------------------------------------
# Query Perplexity Function
# -----------------------------------------------------------------------------
def query_perplexity(statement: str):
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
    
    content_str = response["choices"][0]["message"]["content"]
    print("\nFull Response:", content_str)

    justification_start = content_str.find('"justification":') + len('"justification":')
    justification_end = content_str.find(',"sources"')
    justification = content_str[justification_start:justification_end].strip().strip('"')

    true_start = content_str.find('"isTrue":') + len('"isTrue":')
    true_end = content_str.find(',"justification"')
    true_str = content_str[true_start:true_end].strip().strip('"')

    return content_str, justification, true_str

# -----------------------------------------------------------------------------
# ElevenLabs Text-to-Speech Function
# -----------------------------------------------------------------------------
def text_to_speech(text: str) -> bytes:
    audio = ELclient.text_to_speech.convert(
        text=text,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    audio_bytes = b"".join(audio)
    return audio_bytes

# -----------------------------------------------------------------------------
# S3 Upload Function
# -----------------------------------------------------------------------------
def upload_to_s3(file_path, key, bucket_name="audiotreehacks"):
    s3.upload_file(file_path, bucket_name, key)
    return f"https://{bucket_name}.s3.amazonaws.com/{key}"

# -----------------------------------------------------------------------------
# Transcript Handling Function
# -----------------------------------------------------------------------------
def handle_transcript(transcript: str) -> str:
    context_memory.append(transcript)
    enriched_statement = orchestrate_context(transcript)
    print("Enriched Statement:", enriched_statement)
    
    _, justification, true = query_perplexity(enriched_statement)
    print("Justification:", justification)
    
    audio_bytes = text_to_speech(justification)
    
    unique_filename = f"response_{uuid.uuid4().hex}.mp3"
    audio_folder = os.path.join("treehacks", "public", "temp")
    os.makedirs(audio_folder, exist_ok=True)
    output_path = os.path.join(audio_folder, unique_filename)
    
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    
    s3url = upload_to_s3(output_path, unique_filename, "audiotreehacks")
    print("Audio stored at:", output_path)

    asyncio.create_task(publish_event({
        "s3url": s3url,
        "justification": justification,
        "isTrue": true
    }))

    return s3url

# -----------------------------------------------------------------------------
# SSE: Global Event Queue and Publisher
# -----------------------------------------------------------------------------
event_queue = asyncio.Queue()

async def publish_event(event: dict):
    await event_queue.put(event)

async def events_generator():
    while True:
        event = await event_queue.get()
        yield {"data": json.dumps(event) + "\n\n"}

@app.get("/api/stream-tags")
async def stream_tags():
    return EventSourceResponse(events_generator())

@app.get("/api/test-event")
async def test_event():
    test_event_data = {
        "s3url": "https://audiotreehacks.s3.amazonaws.com/response_test.mp3",
        "justification": "This is a test enriched text",
        "isTrue": True,
    }
    await publish_event(test_event_data)
    return {"status": "Test event published"}

# -----------------------------------------------------------------------------
# WebSocket Endpoint: Fetch Transcript
# -----------------------------------------------------------------------------
async def fetch_transcript():
    uri = "ws://localhost:9092/transcript"
    print(f"Attempting to connect to {uri}...")
    async with websockets.connect(uri) as websocket:
        print(f"Connected to {uri}")
        while True:
            try:
                response = await websocket.recv()
                data = json.loads(response)
                chunk = data.get("content", {}).get("data", "")
                print("Received chunk:", chunk)
                if chunk and len(chunk.strip().split()) >= 5:
                    print("Processing chunk:", chunk)
                    handle_transcript(chunk)
                else:
                    print("Chunk too short, ignoring.")
            except websockets.exceptions.ConnectionClosed as e:
                print(f"WebSocket connection closed: {e}")
                break
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
            except Exception as e:
                print(f"Unexpected error: {e}")

# -----------------------------------------------------------------------------
# Run the App with Uvicorn
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("whisper_app:app", host="0.0.0.0", port=8001, reload=True)
