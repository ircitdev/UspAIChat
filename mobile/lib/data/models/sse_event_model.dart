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
          cost: (json['cost'] as num?)?.toDouble(),
        );
      case 'routing_info':
        return SseRoutingInfo(
          selectedModel: json['selectedModel'] as String? ?? '',
          selectedModelId: json['selectedModelId'] as String? ?? '',
          selectedProvider: json['selectedProvider'] as String? ?? '',
          tier: json['tier'] as String? ?? 'MEDIUM',
          confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
          reasoning: json['reasoning'] as String? ?? '',
          costPer1k: (json['costPer1k'] as num?)?.toDouble() ?? 0,
          savings: (json['savings'] as num?)?.toInt() ?? 0,
          score: (json['score'] as num?)?.toDouble() ?? 0,
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
  final double? cost;
  const SseDone({required this.messageId, required this.fullContent, this.balanceAfter, this.cost});
}

class SseRoutingInfo extends SseEvent {
  final String selectedModel;
  final String selectedModelId;
  final String selectedProvider;
  final String tier;
  final double confidence;
  final String reasoning;
  final double costPer1k;
  final int savings;
  final double score;

  const SseRoutingInfo({
    required this.selectedModel,
    required this.selectedModelId,
    required this.selectedProvider,
    required this.tier,
    required this.confidence,
    required this.reasoning,
    required this.costPer1k,
    required this.savings,
    required this.score,
  });

  Map<String, dynamic> toJson() => {
    'selectedModel': selectedModel,
    'selectedModelId': selectedModelId,
    'selectedProvider': selectedProvider,
    'tier': tier,
    'confidence': confidence,
    'reasoning': reasoning,
    'costPer1k': costPer1k,
    'savings': savings,
    'score': score,
  };
}

class SseError extends SseEvent {
  final String error;
  const SseError({required this.error});
}
