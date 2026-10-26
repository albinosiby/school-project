import '../models/duty_models.dart';

/// Duties (`tk_duties`) and duty swap requests (`tk_swaps`).
abstract class IDutyRepository {
  Future<List<Duty>> getDuties();
  Future<Duty?> getDuty(String id);
  /// Marks completed, or reopens (back to upcoming).
  Future<void> setDone(String id, bool done);
  /// Records joining a meeting stream (simulated).
  Future<void> markJoined(String id);
  Future<List<SwapRequest>> getSwaps();
  Future<SwapRequest> requestSwap(SwapRequest request);
  Future<void> cancelSwap(String id);
  Stream<void> watch();
}
