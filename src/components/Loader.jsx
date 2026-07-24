export default function Loader({ message = 'Caricamento...' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: '60vh',
        fontFamily: 'sans-serif',
        color: '#666'
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: '3px solid #ccc',
          borderTopColor: '#4a3f2f',
          borderRadius: '50%',
          animation: 'app-spin 0.8s linear infinite'
        }}
      />
      <p style={{ margin: 0 }}>{message}</p>
      <style>{`@keyframes app-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
