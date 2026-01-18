import {
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing
} from 'lucide-react';

const DEFAULT_TONE = 'neutral';

const defaultFormatDuration = (totalSeconds) => {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const parseCallExtraData = (extraData) => {
  if (!extraData) {
    return {};
  }

  if (typeof extraData === 'string') {
    try {
      return JSON.parse(extraData);
    } catch (error) {
      return {};
    }
  }

  return extraData;
};

export const translateCallText = (t, key, fallback, options = {}) => {
  if (typeof t === 'function') {
    const value = t(key, options);
    if (value && value !== key) {
      return value;
    }
  }
  return fallback;
};

const buildDurationText = (extra, formatDuration, t) => {
  const formatted = extra?.duration_formatted
    || (extra?.duration_seconds != null ? formatDuration(extra.duration_seconds) : null);

  if (!formatted) {
    return null;
  }

  return `${translateCallText(t, 'chat.call.duration', 'Duración')}: ${formatted}`;
};

const getMissedReasonCopy = (reason, isOutgoing, t) => {
  switch (reason) {
    case 'timeout':
      return isOutgoing
        ? translateCallText(t, 'chat.call.outgoingTimeout', 'No contestaron')
        : translateCallText(t, 'chat.call.incomingTimeout', 'No contestaste');
    case 'cancelled_by_caller':
      return isOutgoing
        ? translateCallText(t, 'chat.call.youCancelled', 'Cancelaste la llamada')
        : translateCallText(t, 'chat.call.theyCancelled', 'La otra persona canceló la llamada');
    case 'rejected_by_receiver':
      return isOutgoing
        ? translateCallText(t, 'chat.call.outgoingRejected', 'Rechazaron la llamada')
        : translateCallText(t, 'chat.call.incomingRejected', 'Rechazaste la llamada');
    default:
      return null;
  }
};

const getEndReasonCopy = (endReason, endedByUserId, currentUserId, t) => {
  if (!endReason) {
    return null;
  }

  switch (endReason) {
    case 'manual_stop':
    case 'user_ended_call_cleanup':
      if (currentUserId && endedByUserId) {
        return endedByUserId === currentUserId
          ? translateCallText(t, 'chat.call.youEnded', 'Finalizaste la llamada')
          : translateCallText(t, 'chat.call.theyEnded', 'La otra persona finalizó la llamada');
      }
      return translateCallText(t, 'chat.call.theyEnded', 'La otra persona finalizó la llamada');
    case 'replaced_by_new_call':
      return translateCallText(t, 'chat.call.replacedCall', 'Se atendió otra llamada');
    default:
      return null;
  }
};

const resolveDirectionMeta = ({ extra, currentUserId, messageUserId, messageUserName }) => {
  const initiatedBy = extra?.initiated_by_user_id ?? extra?.caller_id ?? null;
  const fallbackInitiator = messageUserId ?? null;
  const isOutgoing = currentUserId ? (initiatedBy ?? fallbackInitiator) === currentUserId : false;
  const counterpartName = isOutgoing
    ? (extra?.missed_by_name || extra?.receiver_name || extra?.answered_by_name)
    : (extra?.initiated_by_name || extra?.caller_name || messageUserName);

  return { isOutgoing, counterpartName };
};

export const buildCallEventSummary = ({
  eventType,
  extra = {},
  currentUserId,
  messageUserId,
  messageUserName,
  t,
  formatDuration
}) => {
  if (!eventType) {
    return null;
  }

  const { isOutgoing, counterpartName } = resolveDirectionMeta({
    extra,
    currentUserId,
    messageUserId,
    messageUserName
  });

  const safeFormatDuration = typeof formatDuration === 'function'
    ? formatDuration
    : defaultFormatDuration;

  let tone = DEFAULT_TONE;
  let Icon = PhoneCall;
  let title = translateCallText(t, 'chat.call.genericEvent', 'Evento de llamada');
  const descriptionParts = [];

  if (eventType === 'call_missed') {
    tone = 'danger';
    Icon = extra?.missed_reason === 'cancelled_by_caller' ? PhoneOff : PhoneMissed;
    title = isOutgoing
      ? translateCallText(t, 'chat.call.outgoingNoAnswer', 'Llamada saliente sin respuesta')
      : translateCallText(t, 'chat.call.missedIncoming', 'Llamada perdida');

    if (counterpartName) {
      const prefix = isOutgoing
        ? translateCallText(t, 'chat.call.to', 'Para')
        : translateCallText(t, 'chat.call.from', 'De');
      descriptionParts.push(`${prefix} ${counterpartName}`);
    }

    const reasonText = getMissedReasonCopy(extra?.missed_reason, isOutgoing, t);
    if (reasonText) {
      descriptionParts.push(reasonText);
    }
  } else if (eventType === 'call_ended') {
    tone = 'success';
    Icon = isOutgoing ? PhoneOutgoing : PhoneIncoming;
    title = isOutgoing
      ? translateCallText(t, 'chat.call.outgoingCall', 'Llamada saliente')
      : translateCallText(t, 'chat.call.incomingCall', 'Llamada entrante');

    if (counterpartName) {
      descriptionParts.push(`${translateCallText(t, 'chat.call.with', 'Con')} ${counterpartName}`);
    }

    const durationText = buildDurationText(extra, safeFormatDuration, t);
    if (durationText) {
      descriptionParts.push(durationText);
    }

    const endReasonText = getEndReasonCopy(extra?.end_reason, extra?.ended_by_user_id, currentUserId, t);
    if (endReasonText) {
      descriptionParts.push(endReasonText);
    }
  } else {
    return null;
  }

  return { tone, Icon, title, descriptionParts, isOutgoing, counterpartName };
};

const CALL_TEXT_PATTERNS = [
  {
    type: 'call_missed',
    tests: [
      /llamada\s+perdida/i,
      /llamada\s+sin\s+respuesta/i,
      /llamada\s+cancelad[ao]/i,
      /cancelaste\s+la\s+llamada/i,
      /no\s+contestaron/i,
      /missed\s+call/i,
      /call\s+missed/i,
      /call\s+cancelled/i,
      /call\s+canceled/i
    ]
  },
  {
    type: 'call_ended',
    tests: [
      /llamada\s+finalizada/i,
      /llamada\s+saliente/i,
      /llamada\s+entrante/i,
      /call\s+ended/i,
      /outgoing\s+call/i,
      /incoming\s+call/i
    ]
  }
];

const inferCallEventTypeFromText = (text) => {
  if (!text) {
    return null;
  }

  for (const pattern of CALL_TEXT_PATTERNS) {
    if (pattern.tests.some((regex) => regex.test(text))) {
      return pattern.type;
    }
  }

  return null;
};

export const buildConversationCallPreview = ({
  conversation,
  currentUserId,
  currentUserName,
  t,
  formatDuration
}) => {
  if (!conversation) {
    return null;
  }

  const supportedTypes = ['call_missed', 'call_ended'];
  const inferredType = conversation.last_message_type
    || inferCallEventTypeFromText(conversation.last_message)
    || inferCallEventTypeFromText(conversation.last_message_preview);

  if (!supportedTypes.includes(inferredType)) {
    return null;
  }

  const extraSource = conversation.last_message_extra_data
    ?? conversation.last_message_extra
    ?? conversation.last_message_extraData
    ?? null;
  const extra = parseCallExtraData(extraSource);

  const summary = buildCallEventSummary({
    eventType: inferredType,
    extra,
    currentUserId,
    messageUserId: conversation.last_message_sender_id,
    messageUserName: conversation.last_message_sender_name
      || (conversation.last_message_sender_id === currentUserId ? currentUserName : conversation.other_user_name),
    t,
    formatDuration
  });

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    text: inferredType === 'call_missed'
      ? translateCallText(t, 'chat.call.missedPreview', 'Llamada perdida')
      : summary.title
  };
};

export const CALL_PREVIEW_TONE_CLASSES = {
  danger: {
    text: 'text-red-200',
    icon: 'text-red-300'
  },
  success: {
    text: 'text-emerald-200',
    icon: 'text-emerald-300'
  },
  neutral: {
    text: 'text-slate-200',
    icon: 'text-slate-300'
  }
};
