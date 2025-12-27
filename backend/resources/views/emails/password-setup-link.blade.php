<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Establecer Contraseña</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #ff007a, #e6006e);
            color: white;
            text-align: center;
            padding: 30px 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
        }
        .content {
            padding: 40px 30px;
            color: #333;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #ff007a;
        }
        .message {
            font-size: 16px;
            margin-bottom: 30px;
            color: #555;
        }
        .button-container {
            text-align: center;
            margin: 40px 0;
        }
        .setup-button {
            display: inline-block;
            background: linear-gradient(135deg, #ff007a, #e6006e);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            font-size: 16px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255, 0, 122, 0.3);
        }
        .setup-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 0, 122, 0.4);
        }
        .alternative-link {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #ff007a;
        }
        .alternative-link p {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666;
        }
        .link-text {
            word-break: break-all;
            font-family: monospace;
            background: #fff;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #ddd;
            font-size: 12px;
        }
        .warning {
            margin-top: 30px;
            padding: 15px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            color: #856404;
        }
        .footer {
            background: #f8f9fa;
            text-align: center;
            padding: 20px;
            font-size: 14px;
            color: #666;
        }
        .security-info {
            margin-top: 20px;
            font-size: 14px;
            color: #666;
            background: #e9ecef;
            padding: 15px;
            border-radius: 8px;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 5px;
            }
            .content {
                padding: 20px 15px;
            }
            .setup-button {
                padding: 12px 25px;
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔑 Establecer Contraseña</h1>
        </div>
        
        <div class="content">
            <div class="greeting">
                ¡Hola {{ $userName }}!
            </div>
            
            <div class="message">
                Como te registraste con Google, no tienes una contraseña establecida. 
                Haz clic en el botón de abajo para establecer una contraseña para tu cuenta.
            </div>
            
            <div class="button-container">
                <a href="{{ $setupLink }}" class="setup-button">
                    Establecer mi contraseña
                </a>
            </div>
            
            <div class="alternative-link">
                <p><strong>¿El botón no funciona?</strong></p>
                <p>Copia y pega este enlace en tu navegador:</p>
                <div class="link-text">{{ $setupLink }}</div>
            </div>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong> Este enlace expirará en <strong>24 horas</strong> por tu seguridad.
                Si no solicitaste establecer una contraseña, puedes ignorar este correo.
            </div>
            
            <div class="security-info">
                <strong>🛡️ Información de seguridad:</strong><br>
                • Este enlace solo funciona una vez<br>
                • Después de establecer tu contraseña, podrás iniciar sesión tanto con Google como con tu email y contraseña<br>
                • Tu cuenta seguirá funcionando normalmente con Google
            </div>
        </div>
        
        <div class="footer">
            <p>Este correo fue enviado automáticamente, por favor no respondas a este mensaje.</p>
            <p>&copy; {{ date('Y') }} {{ config('app.name') }}. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>





