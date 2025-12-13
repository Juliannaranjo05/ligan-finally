<?php

// app/Notifications/PaymentMethodChanged.php
namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PaymentMethodChanged extends Notification
{
    use Queueable;

    protected $newMethod;
    protected $previousMethod;

    public function __construct($newMethod, $previousMethod = null)
    {
        $this->newMethod = $newMethod;
        $this->previousMethod = $previousMethod;
    }

    public function via($notifiable)
    {
        return ['mail', 'database']; // Agregar notificación en base de datos
    }

    public function toMail($notifiable)
    {
        $methodNames = [
            'bancolombia' => 'Bancolombia',
            'nequi' => 'Nequi',
            'payoneer' => 'Payoneer',
            'other' => 'Otro método'
        ];

        $newMethodName = $methodNames[$this->newMethod] ?? $this->newMethod;
        $previousMethodName = $this->previousMethod ? $methodNames[$this->previousMethod] ?? $this->previousMethod : 'No configurado';

        return (new MailMessage)
                    ->subject('🔔 Método de Pago Actualizado')
                    ->greeting('¡Hola ' . $notifiable->name . '!')
                    ->line('Tu método de pago ha sido actualizado exitosamente.')
                    ->line('**Método anterior:** ' . $previousMethodName)
                    ->line('**Nuevo método:** ' . $newMethodName)
                    ->line('⚠️ **Importante:** Tu nuevo método de pago requiere verificación antes de poder recibir pagos.')
                    ->action('Verificar Método de Pago', url('/dashboard/settings'))
                    ->line('Si no realizaste este cambio, por favor contacta con soporte inmediatamente.')
                    ->action('Contactar Soporte', url('/soporte'))
                    ->line('Gracias por usar nuestro servicio!')
                    ->salutation('Equipo de ' . config('app.name'));
    }

    public function toDatabase($notifiable)
    {
        $methodNames = [
            'bancolombia' => 'Bancolombia',
            'nequi' => 'Nequi',
            'payoneer' => 'Payoneer',
            'other' => 'Otro método'
        ];

        return [
            'title' => 'Método de pago actualizado',
            'message' => 'Tu método de pago ha sido cambiado a ' . ($methodNames[$this->newMethod] ?? $this->newMethod),
            'type' => 'payment_method_changed',
            'data' => [
                'new_method' => $this->newMethod,
                'previous_method' => $this->previousMethod,
                'requires_verification' => true,
            ],
            'created_at' => now(),
        ];
    }
}