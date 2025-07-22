import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/patients/")
      .then((res) => setPatients(res.data))
      .catch((err) => console.error("Hasta verisi çekilemedi:", err));
  }, []);

  return (
    <div
      style={{
        padding: "36px 36px 0 36px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h2
        style={{
          marginBottom: 26,
          fontWeight: 700,
          fontSize: 28,
          color: "var(--accent-hover)",
          letterSpacing: ".5px",
        }}
      >
        Hasta Listesi
      </h2>

      <div
        style={{
          border: "1.5px solid var(--border-card)",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "var(--card-bg)",
            transition: "background 0.2s, color 0.2s",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--bg-muted)",
                borderBottom: "2px solid var(--border-card)",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              <th style={thStyle}>Ad Soyad</th>
              <th style={thStyle}>TC</th>
              <th style={thStyle}>Yaş</th>
              <th style={thStyle}>Cinsiyet</th>
              <th style={thStyle}>Hastalık</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p, i) => (
              <tr
                key={p.id}
                style={{
                  cursor: "pointer",
                  background:
                    i % 2 === 1 ? "var(--bg-muted)" : "var(--card-bg)",
                  transition: "background 0.17s",
                }}
                onClick={() => navigate(`/patients/${p.id}`)}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "var(--accent-muted)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background =
                    i % 2 === 1 ? "var(--bg-muted)" : "var(--card-bg)")
                }
              >
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600 }}>
                    {p.first_name} {p.last_name}
                  </span>
                </td>
                <td style={tdStyle}>{p.tc_no}</td>
                <td style={tdStyle}>{p.age ?? "-"}</td>
                <td style={tdStyle}>{p.gender ?? "-"}</td>
                <td style={tdStyle}>{p.diagnosis ?? "-"}</td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "38px 0",
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  Kayıtlı hasta bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = {
  padding: "15px 6px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 16,
  color: "var(--text-main)",
  letterSpacing: ".4px",
  transition: "color 0.2s",
};

const tdStyle = {
  padding: "13px 6px",
  borderBottom: "1px solid var(--border-card)",
  fontSize: 15,
  color: "var(--text-main)",
  verticalAlign: "middle",
  transition: "color 0.2s",
};
