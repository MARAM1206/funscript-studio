import os
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import google.generativeai as genai

app = FastAPI(title="FunScript Studio - AI Subtitle Server")

# Habilitar CORS para conectar con el editor web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración del modelo Whisper en GPU NVIDIA (CUDA)
# Puedes usar 'tiny', 'base', 'small' o 'medium' ('small' es el balance ideal)
print("⏳ Cargando modelo Whisper en GPU NVIDIA...")
try:
    whisper_model = WhisperModel("small", device="cuda", compute_type="float16")
    print("✅ Whisper cargado exitosamente en CUDA.")
except Exception as e:
    print(f"⚠️ CUDA no disponible o error ({e}). Usando CPU como respaldo...")
    whisper_model = WhisperModel("small", device="cpu", compute_type="int8")

def format_timestamp(seconds: float) -> str:
    millis = int((seconds - int(seconds)) * 1000)
    mins, secs = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    return f"{hours:02d}:{mins:02d}:{secs:02d}.{millis:03d}"

SYSTEM_PROMPT = """Eres un traductor y adaptador profesional de subtítulos para videos de entretenimiento para adultos y cine pasional.
Tu objetivo es traducir el diálogo en inglés al español de forma fluida, natural, inmersiva y con la jerga/tono adecuado.
Reglas estrictas:
1. No hagas traducciones literales o acartonadas estilo Google Translate.
2. Adapta modismos, expresiones informales, órdenes y gemidos/expresiones coloquiales de forma sugerente y natural en español.
3. Mantén la numeración y estructura de los bloques exactamente como se te entregan.
4. Devuelve ÚNICAMENTE los bloques traducidos, sin introducciones ni comentarios adicionales.
"""

@app.post("/translate-video")
async def process_video_subtitles(
    video: UploadFile = File(...),
    api_key: str = Form(...)
):
    if not api_key:
        raise HTTPException(status_code=400, detail="Debes proporcionar tu API Key gratuita de Gemini.")

    # Configurar API de Gemini
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=SYSTEM_PROMPT)

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(video.filename)[1]) as tmp_video:
        tmp_video.write(await video.read())
        tmp_video_path = tmp_video.name

    try:
        # 1. Transcripción con Whisper
        segments, _ = whisper_model.transcribe(tmp_video_path, beam_size=5, language="en")
        raw_segments = list(segments)

        if not raw_segments:
            return {"vtt": "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n[Sin diálogo detectado]"}

        # 2. Preparar texto para la IA
        batch_text = "\n".join([f"[{i+1}] {seg.text.strip()}" for i, seg in enumerate(raw_segments)])
        
        # 3. Traducción adaptativa con Gemini
        prompt = f"Traduce los siguientes bloques de diálogo de manera natural y apasionada:\n\n{batch_text}"
        response = model.generate_content(prompt)
        translated_lines = response.text.strip().split("\n")

        # Mapear traducciones
        translations = {}
        for line in translated_lines:
            if line.startswith("[") and "]" in line:
                idx_part, text_part = line.split("]", 1)
                try:
                    idx = int(idx_part.replace("[", "").strip())
                    translations[idx] = text_part.strip()
                except ValueError:
                    continue

        # 4. Construir formato WEBVTT
        vtt_output = ["WEBVTT\n"]
        for i, seg in enumerate(raw_segments):
            start_ts = format_timestamp(seg.start)
            end_ts = format_timestamp(seg.end)
            text_es = translations.get(i + 1, seg.text.strip())
            vtt_output.append(f"{start_ts} --> {end_ts}\n{text_es}\n")

        return {"vtt": "\n".join(vtt_output), "filename": f"{os.path.splitext(video.filename)[0]}.vtt"}

    finally:
        if os.path.exists(tmp_video_path):
            os.remove(tmp_video_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
