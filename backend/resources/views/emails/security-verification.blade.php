<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Código de Verificación</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #0a0d10;
            color: #ffffff;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #1a1c20;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #ff007a;
            margin: 0;
            font-size: 24px;
        }
        .code-container {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background-color: #2b2d31;
            border-radius: 8px;
            border: 2px solid #ff007a;
        }
        .verification-code {
            font-size: 32px;
            font-weight: bold;
            color: #ffffff;
            letter-spacing: 6px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
        }
        .warning {
            background-color: #ff1744;
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #ffffff;
            opacity: 0.7;
        }
        .action-info {
            background-color: #2b2d31;
            border-left: 4px solid #ff007a;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Código de Verificación</h1>
        </div>

        <p>Hola {{ $userName ?? 'Usuario' }},</p>

        <div class="action-info">
            <p>Has solicitado <strong>{{ $actionTitle }}</strong>. Para continuar, necesitamos verificar tu identidad.</p>
        </div>

        <div class="code-container">
            <div style="color: #ff007a; font-size: 14px; margin-bottom: 10px;">TU CÓDIGO DE VERIFICACIÓN:</div>
            <div class="verification-code">{{ $code }}</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 10px;">Este código expira en 15 minutos</div>
        </div>

        @if($actionType === 'delete_account')
            <div class="warning">
                ⚠️ <strong>ADVERTENCIA:</strong> Esta acción eliminará permanentemente tu cuenta y todos tus datos. Esta acción no se puede deshacer.
            </div>
        @elseif($actionType === 'logout_all')
            <div class="warning">
                ⚠️ <strong>NOTA:</strong> Esta acción cerrará todas tus sesiones activas en todos los dispositivos, excepto el actual.
            </div>
        @endif

        <div style="background-color: #2b2d31; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #ff007a; margin: 0 0 10px 0; font-size: 14px;">🛡️ Consejos de seguridad:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                <li>Nunca compartas este código con nadie</li>
                <li>Ligand nunca te pedirá este código por teléfono</li>
                <li>Si no solicitaste esta acción, ignora este correo</li>
                <li>El código expira automáticamente en 15 minutos</li>
            </ul>
        </div>

        <p style="margin-top: 30px; font-size: 14px; opacity: 0.8;">
            Si no solicitaste esta verificación, puedes ignorar este correo de forma segura.
        </p>

        <div class="footer">
            <p>Este es un correo automático de Ligand. No respondas a este mensaje.</p>
            <p>&copy; {{ date('Y') }} Ligand. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>