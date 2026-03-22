import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../models/folder_model.dart';
import 'api_client.dart';

class FolderApi {
  final ApiClient _client;
  Dio get _dio => _client.dio;

  FolderApi(this._client);

  Future<List<Folder>> getFolders() async {
    final response = await _dio.get(ApiConstants.folders);
    return (response.data as List).map((e) => Folder.fromJson(e)).toList();
  }

  Future<Folder> createFolder(String name, {String color = '#8b5cf6'}) async {
    final response = await _dio.post(ApiConstants.folders, data: {'name': name, 'color': color});
    return Folder.fromJson(response.data);
  }

  Future<Folder> updateFolder(String id, Map<String, dynamic> data) async {
    final response = await _dio.put(ApiConstants.folder(id), data: data);
    return Folder.fromJson(response.data);
  }

  Future<void> deleteFolder(String id) async {
    await _dio.delete(ApiConstants.folder(id));
  }
}
