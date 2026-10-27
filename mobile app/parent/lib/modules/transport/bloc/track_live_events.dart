import '../../../core/bloc/child_data_bloc.dart';
import '../models/transport_models.dart';

export '../../../core/bloc/child_data_bloc.dart'
    show ChildDataEvent, LoadChildData, RefreshChildData;

/// Turn a bus "notify me" alert on or off for the selected child.
class ToggleBusAlert extends ChildDataEvent {
  const ToggleBusAlert(this.alert, this.enabled);
  final BusAlert alert;
  final bool enabled;
  @override
  List<Object?> get props => [alert, enabled];
}

/// Timer tick: fetch the bus's latest GPS position.
class PollBusPosition extends ChildDataEvent {
  const PollBusPosition();
}
