import os
import json
from cryptography.fernet import Fernet

fernet = Fernet(os.getenv("FERNET_KEY"))

def encrypt_message(messages):
    if isinstance(messages, str):
        messages = {"text": messages}
    raw = json.dumps(messages).encode("utf-8")
    cipher = fernet.encrypt(raw)
    return cipher.decode("utf-8")

def decrypt_message(cipher_text):
    raw = fernet.decrypt(cipher_text.encode("utf-8"))
    try:
        data = json.loads(raw)
    except Exception:
        data = raw.decode("utf-8")

    # Her zaman array döndürmek için
    if isinstance(data, list):
        return data
    elif isinstance(data, dict):
        return [data]
    elif isinstance(data, str):
        return [{"text": data}]
    else:
        return []
