import { useState, useRef, useEffect } from "react";

const PhoneIcon = ({ size = 20, color = "var(--accent-color)" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill="none"
    viewBox="0 0 24 24"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.21.42 2.39.86 3.5a2 2 0 0 1-.45 2.11L9.91 10.09a16 16 0 0 0 6 6l1.76-1.76a2 2 0 0 1 2.11-.45c1.1.44 2.28.73 3.5.86a2 2 0 0 1 1.72 2z" />
  </svg>
);

const VideoIcon = ({ size = 20, color = "var(--accent-color)" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill="none"
    viewBox="0 0 24 24"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    <path d="M23 7l-7 5 7 5V7zM1 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5z" />
  </svg>
);

export default function Chat() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const fileInputRef = useRef(null);
  const messageEndRef = useRef(null);

  const contacts = [
    { id: 1, name: "Ali Veli", avatar: "https://i.pravatar.cc/150?img=1" },
    { id: 2, name: "Ayşe Fatma", avatar: "https://i.pravatar.cc/150?img=2" },
    { id: 3, name: "Mehmet Can", avatar: "https://i.pravatar.cc/150?img=3" },
  ];

  useEffect(() => {
    if (selectedChat) {
      setMessages([
        { id: 1, fromMe: false, text: "Selam, nasılsın?" },
        { id: 2, fromMe: true, text: "İyiyim, teşekkürler! Sen?" },
        { id: 3, fromMe: false, text: "Ben de iyiyim, teşekkürler." },
      ]);
    }
  }, [selectedChat]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (newMessage.trim() === "") return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), fromMe: true, text: newMessage },
    ]);
    setNewMessage("");
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log("Seçilen dosya:", file.name);

    e.target.value = null;
  };

  const startVoiceCall = () => {
    alert("Sesli arama başlatıldı");
  };

  const startVideoCall = () => {
    alert("Görüntülü arama başlatıldı");
  };

  return (
    <div style={styles.container}>
      <div style={styles.contacts}>
        <h3 style={styles.contactsHeader}>Sohbetler</h3>
        {contacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => setSelectedChat(contact.id)}
            style={{
              ...styles.contactItem,
              backgroundColor:
                selectedChat === contact.id
                  ? "var(--nav-bg-active)"
                  : "transparent",
              color: "var(--text-main)",
            }}
          >
            <img
              src={contact.avatar}
              alt={contact.name}
              style={styles.avatar}
            />
            <span>{contact.name}</span>
          </div>
        ))}
      </div>

      <div style={styles.chatArea}>
        {selectedChat ? (
          <>
            <div style={styles.chatHeaderGrid}>
              <div style={styles.chatHeaderLeft}>
                <img
                  src={contacts.find((c) => c.id === selectedChat)?.avatar}
                  alt="avatar"
                  style={styles.chatAvatar}
                />
                <h3 style={{ color: "var(--text-main)", marginLeft: 12 }}>
                  {contacts.find((c) => c.id === selectedChat)?.name}
                </h3>
              </div>
              <div style={styles.chatHeaderRight}>
                <button
                  onClick={startVoiceCall}
                  style={styles.iconButton}
                  title="Sesli Arama"
                >
                  <PhoneIcon />
                </button>
                <button
                  onClick={startVideoCall}
                  style={styles.iconButton}
                  title="Görüntülü Arama"
                >
                  <VideoIcon />
                </button>
              </div>
            </div>

            <div style={styles.messages}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.message,
                    alignSelf: msg.fromMe ? "flex-end" : "flex-start",
                    backgroundColor: msg.fromMe
                      ? "var(--accent-color)"
                      : "var(--bg-muted)",
                    color: msg.fromMe ? "white" : "var(--text-main)",
                    borderTopRightRadius: msg.fromMe ? 0 : 15,
                    borderTopLeftRadius: msg.fromMe ? 15 : 0,
                    boxShadow: msg.fromMe
                      ? "var(--shadow-strong)"
                      : "var(--shadow-card)",
                  }}
                >
                  {msg.text}
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>

            <div style={styles.inputArea}>
              <button
                onClick={handleFileButtonClick}
                style={styles.addFileButton}
                title="Dosya veya Görsel Ekle"
              >
                +
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="image/*,.pdf"
                onChange={handleFileChange}
              />
              <input
                type="text"
                placeholder="Mesaj yaz..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                style={styles.input}
              />
              <button onClick={sendMessage} style={styles.sendButton}>
                Gönder
              </button>
            </div>
          </>
        ) : (
          <div style={{ ...styles.noChatSelected, color: "var(--text-muted)" }}>
            Bir sohbet seçiniz
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "var(--bg-main)",
  },
  contacts: {
    width: 320,
    borderRight: "1px solid var(--border-card)",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--card-bg)",
  },
  contactsHeader: {
    margin: 0,
    padding: "20px",
    borderBottom: "1px solid var(--border-card)",
    fontWeight: 600,
    color: "var(--text-main)",
  },
  contactItem: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    padding: "15px 20px",
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    objectFit: "cover",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--bg-main)",
  },
  chatHeaderGrid: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    padding: 20,
    borderBottom: "1px solid var(--border-card)",
    backgroundColor: "var(--card-bg)",
  },
  chatHeaderLeft: {
    display: "flex",
    alignItems: "center",
  },
  chatHeaderRight: {
    display: "flex",
    gap: 12,
  },
  iconButton: {
    cursor: "pointer",
    padding: 6,
    borderRadius: 6,
    border: "none",
    backgroundColor: "transparent",
    transition: "background-color 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--accent-color)",
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    objectFit: "cover",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  message: {
    maxWidth: "60%",
    padding: "10px 16px",
    borderRadius: 15,
    fontSize: 15,
    wordBreak: "break-word",
  },
  inputArea: {
    display: "flex",
    padding: 15,
    borderTop: "1px solid var(--border-card)",
    backgroundColor: "var(--card-bg)",
    alignItems: "center",
  },
  addFileButton: {
    cursor: "pointer",
    fontSize: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    border: "none",
    backgroundColor: "var(--accent-color)",
    color: "white",
    marginRight: 10,
    fontWeight: "bold",
    lineHeight: "32px",
    textAlign: "center",
    userSelect: "none",
    transition: "background-color 0.2s",
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 25,
    border: "1px solid var(--input-border)",
    fontSize: 15,
    outline: "none",
    backgroundColor: "var(--input-bg)",
    color: "var(--text-main)",
  },
  sendButton: {
    marginLeft: 10,
    padding: "0 28px",
    borderRadius: 25,
    border: "none",
    backgroundColor: "var(--accent-color)",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.3s",
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonHover: {
    backgroundColor: "var(--accent-hover)",
  },
  noChatSelected: {
    margin: "auto",
    fontSize: 18,
  },
};
