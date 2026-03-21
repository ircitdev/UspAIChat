sealed class SseEvent {
  const SseEvent();

  factory SseEvent.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String;
    switch (type) {
      case 'start':
        return SseStart(messageId: json['message_id'] as String);
      case 'chunk':
        return SseChunk(content: json['content'] as String);
      case 'tokens':
        return SseTokens(count: json['count'] as int);
      case 'price':
        return SsePrice(pricePer1k: (json['pricePer1k'] as num).toDouble());
      case 'done':
        return SseDone(
          messageId: json['message_id'] as String,
          fullContent: json['full_content'] as String,
          balanceAfter: (json['balance_after'] as num?)?.toDouble(),
        );
      case 'error':
        return SseError(error: json['error'] as String);
      default:
        return SseError(error: 'Unknown event type: $type');
    }
  }
}

class SseStart extends SseEvent {
  final String messageId;
  const SseStart({required this.messageId});
}

class SseChunk extends SseEvent {
  final String content;
  const SseChunk({required this.content});
}

class SseTokens extends SseEvent {
  final int count;
  const SseTokens({required this.count});
}

class SsePrice extends SseEvent {
  final double pricePer1k;
  const SsePrice({required this.pricePer1k});
}

class SseDone extends SseEvent {
  final String messageId;
  final String fullContent;
  final double? balanceAfter;
  const SseDone({required this.messageId, required this.fullContent, this.balanceAfter});
}

class SseError extends SseEvent {
  final String error;
  const SseError({required this.error});
}
