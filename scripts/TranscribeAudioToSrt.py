import argparse
import os
from faster_whisper import WhisperModel


def srt_time(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis -= 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def clean_text(text: str) -> str:
    return " ".join(text.replace("\n", " ").split()).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_path")
    parser.add_argument("output_srt")
    parser.add_argument("--model", default="small")
    parser.add_argument("--language", default="zh")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    args = parser.parse_args()

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments, info = model.transcribe(
        args.audio_path,
        language=args.language,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 250},
    )

    lines = []
    cue_index = 1
    for segment in segments:
        text = clean_text(segment.text)
        if not text:
            continue
        lines.append(str(cue_index))
        lines.append(f"{srt_time(segment.start)} --> {srt_time(segment.end)}")
        lines.append(text)
        lines.append("")
        cue_index += 1

    os.makedirs(os.path.dirname(os.path.abspath(args.output_srt)), exist_ok=True)
    with open(args.output_srt, "w", encoding="utf-8") as file:
        file.write("\n".join(lines))

    print({
        "audio_path": os.path.abspath(args.audio_path),
        "output_srt": os.path.abspath(args.output_srt),
        "model": args.model,
        "language": info.language,
        "language_probability": info.language_probability,
        "cues": cue_index - 1,
    })


if __name__ == "__main__":
    main()
