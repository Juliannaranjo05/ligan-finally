import { useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext.jsx';

export const VideochatEndedNotice = () => {
  const { showWarning } = useNotification();

  useEffect(() => {
    if (sessionStorage.getItem('videochatEndedByNav') === 'true') {
      sessionStorage.removeItem('videochatEndedByNav');
      showWarning('📴 Llamada finalizada', {
        title: 'Cambiaste de pantalla',
        duration: 5000
      });
    }
  }, [showWarning]);

  return null;
};

const RouteGuard = ({ children }) => {
  return children;

};

export default RouteGuard;