import '../../../core/bloc/child_data_bloc.dart';
import '../models/message_models.dart';

export '../../../core/bloc/child_data_bloc.dart' show DataState, LoadStatus;

typedef MessagesState = DataState<MessagesOverview>;
typedef UnreadCountState = DataState<int>;
