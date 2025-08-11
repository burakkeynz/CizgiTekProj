# backend/prompts.py
import re

# ----- TRANSCRIBE -----
PROMPT_TRANSCRIBE_TR = (
    "Sen bir konuşma-metne dönüştürücüsün.\n"
    "Görev: Seste sadece anlaşılır İNSAN konuşmasını yazıya çevir.\n"
    "Kurallar:\n"
    "- Çıktı yalın DÜZ METİN olmalı; köşeli parantezli etiket üretme "
    "(ör. [no clear speech], [laughter], [music]).\n"
    "- Anlaşılır konuşma yoksa TAMAMEN BOŞ döndür (hiçbir şey yazma).\n"
    "- Uydurma yapma; emin olmadığın kelimeyi atla.\n"
    "- Türkçeyi koru; varsa İngilizce kelimeleri duyduğun gibi yaz. "
    "Normal noktalama kullan.\n"
    "Sadece metni döndür."
)

PROMPT_TRANSCRIBE_EN = (
    "You are a speech-to-text engine.\n"
    "Task: Transcribe only intelligible HUMAN speech from the audio.\n"
    "Rules:\n"
    "- Output MUST be plain text only; do NOT include bracketed annotations "
    "(e.g., [no clear speech], [laughter], [music]).\n"
    "- If there is no intelligible speech, return an EMPTY string.\n"
    "- Do not hallucinate; skip words you are unsure of.\n"
    "- Preserve Turkish; keep English words as spoken. Use normal punctuation.\n"
    "Return ONLY the transcript text."
)

def transcribe_prompt(lang: str | None = "tr") -> str:
    return PROMPT_TRANSCRIBE_TR if (lang or "tr").lower().startswith("tr") else PROMPT_TRANSCRIBE_EN

_TAGS = re.compile(r"\[[^\]]+\]")

def postprocess_transcript(text: str | None) -> str:
    s = _TAGS.sub("", text or "")
    return " ".join(s.split()).strip()

# ----- SUMMARY (Markdown) -----
def _mk_summary_prompt_tr(participants: list[str], when_str: str) -> str:
    plist = ", ".join([p for p in participants if p])
    return (
        "Aşağıda bir görüşmenin transkripti var. Sadece metindeki bilgilere dayan.\n"
        "Çıktı formatı: Markdown. Kısa ve profesyonel yaz (toplam 150–250 kelime).\n"
        f"Meta:\n- Katılımcılar: {plist}\n- Tarih/Saat: {when_str}\n\n"
        "Aşağıdaki başlıklarla yaz:\n"
        "## Katılımcılar\n"
        "## Görüşmenin Başlığı (tek cümle)\n"
        "## Kısa Transkript (3–8 madde)\n"
        "## Kararlar\n"
        "## Aksiyonlar (Sahip → Tarih, yoksa —)\n"
        "## Sonraki Adımlar\n"
        "Kurallar: Uydurma yapma; metinde olmayan kişi/tarih/sayı üretme. "
        "Başlıkları koru. Kalın için **çift yıldız** kullanabilirsin, ama sade ol."
    )

def _mk_summary_prompt_en(participants: list[str], when_str: str) -> str:
    plist = ", ".join([p for p in participants if p])
    return (
        "Below is a call transcript. Rely ONLY on the text.\n"
        "Output format: Markdown. Keep it concise and professional (150–250 words total).\n"
        f"Meta:\n- Participants: {plist}\n- Date/Time: {when_str}\n\n"
        "Use these headings:\n"
        "## Participants\n"
        "## Meeting Title (one sentence)\n"
        "## Short Transcript (3–8 bullets)\n"
        "## Decisions\n"
        "## Action Items (Owner → Due, use — if missing)\n"
        "## Next Steps\n"
        "Rules: No hallucinations; do not invent names/dates/numbers. Keep headings. "
        "You may use **bold** for emphasis, but keep it minimal."
    )

def summary_prompt(lang: str, participants: list[str], when_str: str) -> str:
    return (
        _mk_summary_prompt_tr(participants, when_str)
        if (lang or "tr").lower().startswith("tr")
        else _mk_summary_prompt_en(participants, when_str)
    )

__all__ = ["transcribe_prompt", "postprocess_transcript", "summary_prompt"]
