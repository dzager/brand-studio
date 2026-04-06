export default function Custom404() {
    return (
        <main style={{ maxWidth: 600, margin: "120px auto", padding: 16, fontFamily: "system-ui", textAlign: "center" }}>
            <h1 style={{ fontSize: 48, margin: "0 0 8px" }}>404</h1>
            <p style={{ color: "#666", fontSize: 16, marginBottom: 24 }}>Page not found</p>
            <a
                href="/"
                style={{
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "1px solid #FDB72A",
                    background: "#FDB72A",
                    color: "#191F1D",
                    textDecoration: "none",
                }}
            >
                ← Back to Studio
            </a>
        </main>
    );
}
