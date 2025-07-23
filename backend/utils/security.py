import os
import json
from cryptography.fernet import Fernet

fernet = Fernet(os.getenv("FERNET_KEY"))

def encrypt_message(messages):
    raw = json.dumps(messages).encode("utf-8")
    cipher = fernet.encrypt(raw)
    return cipher.decode("utf-8")

def decrypt_message(cipher_text):
    raw = fernet.decrypt(cipher_text.encode("utf-8"))
    return json.loads(raw)
