import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/datasources/remote/folder_api.dart';
import '../data/models/folder_model.dart';
import 'auth_provider.dart';

final folderApiProvider = Provider<FolderApi>(
  (ref) => FolderApi(ref.read(apiClientProvider)),
);

class FolderNotifier extends StateNotifier<List<Folder>> {
  final FolderApi _api;
  FolderNotifier(this._api) : super([]);

  Future<void> loadFolders() async {
    try {
      state = await _api.getFolders();
    } catch (_) {}
  }

  Future<void> createFolder(String name, {String color = '#8b5cf6'}) async {
    final folder = await _api.createFolder(name, color: color);
    state = [...state, folder];
  }

  Future<void> deleteFolder(String id) async {
    await _api.deleteFolder(id);
    state = state.where((f) => f.id != id).toList();
  }
}

final folderProvider = StateNotifierProvider<FolderNotifier, List<Folder>>(
  (ref) => FolderNotifier(ref.read(folderApiProvider)),
);
