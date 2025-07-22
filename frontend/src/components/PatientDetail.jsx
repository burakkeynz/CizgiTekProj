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
        background: "var(--card-bg)",
        borderRadius: 18,
        boxShadow: "var(--shadow-card)",
        padding: "40px 36px 32px 36px",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <button
        onClick={() => navigate("/patients")}
        style={{
          marginBottom: 18,
          padding: "5px 16px",
          fontSize: 15,
          background: "var(--accent-muted)",
          color: "var(--accent-hover)",
          border: "none",
          borderRadius: 7,
          cursor: "pointer",
          fontWeight: 500,
          transition: "background 0.2s, color 0.2s",
        }}
      >
        ← Geri
      </button>
      <h2
        style={{
          fontSize: 28,
          fontWeight: 700,
          marginBottom: 16,
          color: "var(--accent-hover)",
          letterSpacing: ".5px",
        }}
      >
        {patient.first_name} {patient.last_name}
      </h2>
      <div
        style={{
          marginBottom: 28,
          padding: "22px 24px",
          background: "var(--bg-muted)",
          borderRadius: 12,
          transition: "background 0.2s",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            fontSize: 16,
            color: "var(--text-main)",
            transition: "color 0.2s",
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
          height: 240,
          minHeight: 220,
          marginBottom: 18,
          background: "var(--bg-muted)",
          borderRadius: 12,
          transition: "background 0.2s",
        }}
      >
        <h3
          style={{
            fontWeight: 600,
            fontSize: 20,
            color: "var(--accent-hover)",
            margin: "0 0 12px 0",
            paddingLeft: 8,
            transition: "color 0.2s",
          }}
        >
          Kan Değeri Geçmişi
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
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
    </div>
  );
}
