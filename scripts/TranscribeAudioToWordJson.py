import argparse
import json
import os
from faster_whisper import WhisperModel


def clean_text(text: str) -> str:
    return "".join(str(text or "").split()).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_path")
    parser.add_argument("output_json")
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
        vad_parameters={"min_silence_duration_ms": 180},
        word_timestamps=True,
    )

    output = {
        "audio_path": os.path.abspath(args.audio_path),
        "language": info.language,
        "language_probability": info.language_probability,
        "segments": [],
        "words": [],
    }

    for segment in segments:
        segment_record = {
            "start": float(segment.start),
            "end": float(segment.end),
            "text": clean_text(segment.text),
        }
        output["segments"].append(segment_record)
        for word in segment.words or []:
            text = clean_text(word.word)
            if not text:
                continue
            output["words"].append({
                "start": float(word.start),
                "end": float(word.end),
                "word": text,
            })

    os.makedirs(os.path.dirname(os.path.abspath(args.output_json)), exist_ok=True)
    with open(args.output_json, "w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=2)

    print(json.dumps({
        "audio_path": output["audio_path"],
        "output_json": os.path.abspath(args.output_json),
        "segments": len(output["segments"]),
        "words": len(output["words"]),
        "language": output["language"],
        "language_probability": output["language_probability"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
