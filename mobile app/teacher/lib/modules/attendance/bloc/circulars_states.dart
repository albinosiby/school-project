import 'package:equatable/equatable.dart';
import '../models/circular_models.dart';
import 'load_status.dart';

const circularCategories = ['All', 'Academic', 'Admin', 'Events'];

class CircularsState extends Equatable {
  const CircularsState({this.status = LoadStatus.initial, this.items = const [], this.category = 'All', this.query = '', this.unreadOnly = false, this.newestFirst = true});
  final LoadStatus status;
  final List<Circular> items;
  final String category, query;
  final bool unreadOnly, newestFirst;

  int count(String c) => c == 'All' ? items.length : items.where((e) => e.cat == c).length;
  int get unread => items.where((e) => !e.read).length;
  Circular? byId(String id) => items.where((e) => e.id == id).firstOrNull;

  /// Filtered list; pinned first, then by date.
  List<Circular> get shown {
    final q = query.trim().toLowerCase();
    return items.where((e) {
      if (category != 'All' && e.cat != category) return false;
      if (unreadOnly && e.read) return false;
      return q.isEmpty || '${e.title} ${e.ref} ${e.summary}'.toLowerCase().contains(q);
    }).toList()
      ..sort((a, b) {
        if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
        final c = a.date.compareTo(b.date);
        return newestFirst ? -c : c;
      });
  }

  CircularsState copyWith({LoadStatus? status, List<Circular>? items, String? category, String? query, bool? unreadOnly, bool? newestFirst}) => CircularsState(
        status: status ?? this.status, items: items ?? this.items, category: category ?? this.category, query: query ?? this.query,
        unreadOnly: unreadOnly ?? this.unreadOnly, newestFirst: newestFirst ?? this.newestFirst,
      );

  @override
  List<Object?> get props => [status, items, category, query, unreadOnly, newestFirst];
}
