import '../models/home_models.dart';

abstract class IHomeRepository {
  Stream<HomeSummary> watchToday(String childId);
}
