import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function BloodTestCard({ data }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Kan Değeri Geçmişi</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" />
          <XAxis dataKey="date" stroke="var(--text-muted)" />
          <YAxis stroke="var(--text-muted)" />
          <Tooltip
            contentStyle={{
              background: "var(--card-bg)",
              color: "var(--text-main)",
              borderRadius: 8,
              border: "1px solid var(--border-card)",
              boxShadow: "var(--shadow-card)",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent-hover)"
            strokeWidth={3}
            isAnimationActive={false}
            dot={{ stroke: "var(--accent-hover)", strokeWidth: 2 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardiologyCard({ selectedId, setSelectedId, data }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Kardiyoloji Özetleri</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {data.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setSelectedId(isSelected ? null : item.id)}
              style={{
                cursor: "pointer",
                padding: 12,
                borderRadius: 10,
                background: isSelected
                  ? "var(--accent-hover)"
                  : "var(--bg-muted)",
                color: isSelected ? "white" : "var(--text-main)",
                boxShadow: isSelected ? "var(--shadow-strong)" : "none",
                transition: "all 0.3s ease",
                fontWeight: 600,
                fontSize: isSelected ? 17 : 14,
                userSelect: "none",
              }}
              title={`${item.title} - ${item.date}`}
            >
              <div>{item.title}</div>
              <div
                style={{
                  marginTop: 6,
                  fontWeight: 400,
                  fontSize: 13,
                  maxHeight: isSelected ? 90 : 40,
                  overflow: "hidden",
                }}
              >
                {item.summary}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RadiologyCards({ selectedId, setSelectedId, data }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Radyoloji Görüntüleri</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {data.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setSelectedId(isSelected ? null : item.id)}
              style={{
                cursor: "pointer",
                flex: "1 0 100px",
                height: isSelected ? 120 : 80,
                borderRadius: 12,
                background: isSelected
                  ? "var(--accent-hover)"
                  : "var(--bg-muted)",
                color: isSelected ? "white" : "var(--text-main)",
                boxShadow: isSelected ? "var(--shadow-strong)" : "none",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontWeight: 600,
                fontSize: isSelected ? 16 : 13,
                transition: "all 0.3s ease",
                userSelect: "none",
                textAlign: "center",
                padding: 10,
              }}
              title={`${item.type} - ${item.date}`}
            >
              {item.type}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const navigate = useNavigate();

  const [selectedCardiology, setSelectedCardiology] = useState(null);
  const [selectedRadiology, setSelectedRadiology] = useState(null);

  useEffect(() => {
    api
      .get(`/patients/${id}`)
      .then((res) => setPatient(res.data))
      .catch(() => navigate("/patients"));
  }, [id, navigate]);

  const bloodTestData = useMemo(
    () => [
      { date: "2024-03", value: 5.1 },
      { date: "2024-04", value: 5.6 },
      { date: "2024-05", value: 6.2 },
      { date: "2024-06", value: 5.7 },
      { date: "2024-07", value: 6.0 },
    ],
    []
  );

  const cardiologySummaries = [
    {
      id: 1,
      title: "EKG",
      date: "2024-07-01",
      summary: "Normal sinüs ritmi, taşikardi yok.",
    },
    {
      id: 2,
      title: "Efor Testi",
      date: "2024-07-10",
      summary: "Hafif egzersizle taşikardi, negatif iskemik bulgu.",
    },
  ];

  const radiologyImages = [
    { id: 1, type: "MR", date: "2024-05-12" },
    { id: 2, type: "BT", date: "2024-06-01" },
    { id: 3, type: "Röntgen", date: "2024-06-15" },
  ];

  if (!patient) return <div>Yükleniyor...</div>;

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "40px auto",
        padding: 20,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "auto auto",
        gap: 20,
        background: "var(--card-bg)",
        borderRadius: 18,
        boxShadow: "var(--shadow-card)",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <button
        onClick={() => navigate("/patients")}
        style={{
          gridColumn: "1 / span 2",
          justifySelf: "start",
          padding: "6px 18px",
          fontSize: 15,
          background: "var(--accent-muted)",
          color: "var(--accent-hover)",
          border: "none",
          borderRadius: 7,
          cursor: "pointer",
          fontWeight: 500,
          transition: "background 0.2s, color 0.2s",
          marginBottom: 12,
        }}
      >
        ← Geri
      </button>

      {/* Kan testi */}
      <BloodTestCard
        data={bloodTestData}
        style={{ gridArea: "1 / 1 / 2 / 2" }}
      />

      {/* Kardiyoloji */}
      <CardiologyCard
        selectedId={selectedCardiology}
        setSelectedId={setSelectedCardiology}
        data={cardiologySummaries}
        style={{ gridArea: "1 / 2 / 2 / 3" }}
      />

      {/* Radyoloji */}
      <div style={{ gridColumn: "1 / span 2" }}>
        <RadiologyCards
          selectedId={selectedRadiology}
          setSelectedId={setSelectedRadiology}
          data={radiologyImages}
        />
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--bg-muted)",
    borderRadius: 16,
    padding: 20,
    boxShadow: "var(--shadow-card)",
  },
  cardTitle: {
    marginBottom: 18,
    fontWeight: 600,
    fontSize: 20,
    color: "var(--accent-hover)",
  },
};
