import 'package:equatable/equatable.dart';

enum TripStatus { scheduled, active, completed }

class TripSnapshot extends Equatable {
  const TripSnapshot({
    this.status = TripStatus.scheduled,
    this.boarded = const {},
    this.checked = const {},
    this.handedOver = const {},
  });
  final TripStatus status;
  final Set<String> boarded, checked, handedOver;
  @override
  List<Object?> get props => [status, boarded, checked, handedOver];
}
