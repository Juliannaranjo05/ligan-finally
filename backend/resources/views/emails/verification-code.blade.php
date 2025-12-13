<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de Verificación</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #ff007a, #ff4081);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .code-box {
            background: white;
            border: 2px solid #ff007a;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
        }
        .code {
            font-size: 32px;
            font-weight: bold;
            color: #ff007a;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }
        .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Código de Verificación</h1>
        <p>{{ config('app.name') }}</p>
    </div>
    
    <div class="content">
        <h2>¡Hola {{ $userName }}!</h2>
        
        <p>Has solicitado actualizar tu método de pago. Para confirmar este cambio, utiliza el siguiente código de verificación:</p>
        
        <div class="code-box">
            <div class="code">{{ $code }}</div>
        </div>
        
        <div class="warning">
            <strong>⚠️ Importante:</strong>
            <ul>
                <li>Este código expira en <strong>{{ $expiresIn }}</strong></li>
                <li>Solo ingresa este código si solicitaste el cambio</li>
                <li>Si no fuiste tú, ignora este email</li>
            </ul>
        </div>
        
        <p>Una vez verificado, tu nuevo método de pago estará activo y podrás recibir pagos.</p>
        
        <p>Si tienes algún problema, contacta con nuestro equipo de soporte.</p>
        
        <p>¡Gracias por usar {{ config('app.name') }}!</p>
    </div>
    
    <div class="footer">
        <p>Este es un email automático, por favor no respondas a este mensaje.</p>
        <p>&copy; {{ date('Y') }} {{ config('app.name') }}. Todos los derechos reservados.</p>
    </div>
</body>
</html>