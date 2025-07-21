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

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get(`/patients/${id}`)
      .then((res) => setPatient(res.data))
      .catch(() => navigate("/patients"));
  }, [id, navigate]);

  const chartData = useMemo(
    () => [
      { date: "2024-03", value: 5.1 },
      { date: "2024-04", value: 5.6 },
      { date: "2024-05", value: 6.2 },
      { date: "2024-06", value: 5.7 },
      { date: "2024-07", value: 6.0 },
    ],
    []
  );

  if (!patient) return <div>Yükleniyor...</div>;

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "40px auto 0",
        background: "#fff",
        borderRadius: 18,
        boxShadow: "0 2px 16px #f0f1f5",
        padding: "40px 36px 32px 36px",
      }}
    >
      <button
        onClick={() => navigate("/patients")}
        style={{
          marginBottom: 18,
          padding: "5px 16px",
          fontSize: 15,
          background: "#f2f6ff",
          color: "#4977c7",
          border: "none",
          borderRadius: 7,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        ← Geri
      </button>
      <h2
        style={{
          fontSize: 28,
          fontWeight: 700,
          marginBottom: 16,
          color: "#2a3655",
        }}
      >
        {patient.first_name} {patient.last_name}
      </h2>
      <div
        style={{
          marginBottom: 28,
          padding: "22px 24px",
          background: "#f6f8fd",
          borderRadius: 12,
        }}
      >
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            fontSize: 16,
            color: "#334",
          }}
        >
          <li>
            <b>TC:</b> {patient.tc_no}
          </li>
          <li>
            <b>Yaş:</b> {patient.age ?? "-"}
          </li>
          <li>
            <b>Cinsiyet:</b> {patient.gender ?? "-"}
          </li>
          <li>
            <b>Hastalık:</b> {patient.diagnosis ?? "-"}
          </li>
        </ul>
      </div>
      <div
        style={{
          width: "100%",
          minWidth: 400,
          height: 240, // Sabit yükseklik
          minHeight: 220, // En az 220px
          marginBottom: 18,
          background: "#f6f8fd",
          borderRadius: 12,
        }}
      >
        <h3
          style={{
            fontWeight: 600,
            fontSize: 20,
            color: "#4977c7",
            margin: "0 0 12px 0",
            paddingLeft: 8,
          }}
        >
          Kan Değeri Geçmişi
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#4977c7"
              strokeWidth={3}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
