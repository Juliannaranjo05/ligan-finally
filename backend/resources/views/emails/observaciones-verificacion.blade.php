<!DOCTYPE html>
<html>
<head>
    <title>Observaciones de Verificación</title>
</head>
<body>
    <h2>Hola {{ $userName }},</h2>
    
    <p>Hemos revisado tus documentos de verificación y tenemos algunas observaciones para que puedas corregir:</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
        <h3>Observaciones:</h3>
        <p>{{ $observaciones }}</p>
    </div>
    
    <p>Por favor, revisa estos puntos y envía nuevamente tus documentos corrigiendo lo indicado.</p>
    
    <p>Gracias,<br>
    Equipo de Verificación</p>
</body>
</html>