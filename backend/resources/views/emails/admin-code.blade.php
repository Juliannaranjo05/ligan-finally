<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Código de verificación - Ligand Admin</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#0b0c10; color:#f5f5f5; padding:24px;">
    <div style="max-width:480px;margin:0 auto;background:#111827;border-radius:12px;border:1px solid #4b5563;padding:24px;">
        <h1 style="font-size:20px;margin:0 0 12px;color:#f472b6;">Ligand Admin</h1>
        <p style="margin:0 0 16px;color:#e5e7eb;">Hola,</p>
        <p style="margin:0 0 16px;color:#e5e7eb;">
            Has intentado iniciar sesión en el panel de administración de Ligand.
        </p>
        <p style="margin:0 0 8px;color:#9ca3af;">Tu código de verificación es:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:8px;margin:0 0 16px;color:#f9fafb;">
            {{ $code }}
        </p>
        <p style="margin:0 0 16px;color:#9ca3af;">
            Este código es válido solo por unos minutos. Si no fuiste tú quien inició sesión,
            puedes ignorar este correo.
        </p>
        <p style="margin:0;color:#4b5563;font-size:12px;">&copy; {{ date('Y') }} Ligand</p>
    </div>
</body>
</html>
