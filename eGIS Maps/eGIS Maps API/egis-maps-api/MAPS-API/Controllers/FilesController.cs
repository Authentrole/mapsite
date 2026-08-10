using MapsAPI.Contexts;
using MapsAPI.Entities.eGIS;
using MapsAPI.Entities.Maps;
using MapsAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Rewrite;
using Microsoft.Extensions.Logging;
using Microsoft.OpenApi.Writers;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace MapsAPI.Controllers
{
    [EnableCors("AllowOrigin")]
    [Route("api/[controller]")]
    [ApiController]
    public class FilesController : ControllerBase
    {
        private readonly ILogger<FilesController> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly UFTDBContext _uftContext;
        private readonly MapsDBContext _mapsContext;

        public FilesController(IHttpContextAccessor httpContextAccessor, UFTDBContext uftContext, MapsDBContext mapsContext, ILogger<FilesController> logger)
        {
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            _uftContext = uftContext;
            _mapsContext = mapsContext;
        }

        [HttpPost]
        [Authorize]
        [Route("Search")]
        public FilesResult SearchFiles([FromBody] FilesPayload payload)
        {
            FilesResult fileResult = null;
            List<string> fileNames;
            string msg = "No Files";
            fileResult = new FilesResult();
            try
            {
                _logger.LogInformation("********************************************************************************");
                _logger.LogInformation("Search Started");
                string reqUserId = _httpContextAccessor.HttpContext.User.Identity.Name;
                // LOG-FORGING: strip CR/LF from user-derived values before logging.
                _logger.LogInformation("User :: {user}", SanitizeLogData(reqUserId));
                _logger.LogInformation("{payload}", SanitizeLogData(JsonConvert.SerializeObject(payload)));

                LogAppUsage(reqUserId, payload);

                string filePath = NormalizeAndValidatePath(GlobalVars.PDF_File_Path, payload.filePath);

                int fileCount = Convert.ToInt32(payload.fileCount);
                fileCount = fileCount <= 0 ? 0 : fileCount;
                int pageIndex = Convert.ToInt32(payload.pageIndex);
                pageIndex = pageIndex <= 0 ? 0 : pageIndex;
                int skipCount = (pageIndex - 1) * fileCount;
                skipCount = skipCount <= 0 ? 0 : skipCount;
                string fileName = string.IsNullOrEmpty(payload.fileName) ? "*" : payload.fileName.Trim();
                string fileFormat = fileName.ToLower().Trim().EndsWith(".pdf") ? string.Empty : string.IsNullOrEmpty(payload.fileFormat) ? ".pdf" : "." + payload.fileFormat.Trim();
                fileName = fileName.ToLower().Trim().EndsWith("*") || fileName.ToLower().Trim().EndsWith(".pdf") ? fileName : fileName + "*";

                SearchOption so = SearchOption.AllDirectories;
                if (string.IsNullOrEmpty(payload.includeSubFolders) || payload.includeSubFolders.ToLower().Trim() == "false")
                {
                    so = SearchOption.TopDirectoryOnly;
                }

                if (!string.IsNullOrEmpty(filePath))
                {
                    // filePath is validated, but fileName/fileFormat are user-derived; sanitize the whole line.
                    _logger.LogInformation("Getting Files From :: {searchPath}", SanitizeLogData(filePath + "\\" + fileName + fileFormat));
                    var fileInfos = EnumerateFiles(filePath, fileName + fileFormat, so);
                    List<FileInfo> searchedFiles;
                    if (fileInfos != null)
                    {
                        _logger.LogInformation("Files Found ::" + fileInfos.Count());
                        List<FileInfo> selectedFiles;
                        if (!string.IsNullOrEmpty(payload.commodity))
                        {
                            if (payload.commodity.ToLower().Trim() == "gas")
                            {
                                searchedFiles = fileInfos.Where(f => f.FullName.ToUpper().IndexOf("G_M_AND_S") >= 0 || f.FullName.ToLower().IndexOf("g_reg_plate") >= 0).ToList();
                                selectedFiles = searchedFiles.Skip(skipCount).Take(fileCount).ToList();
                            }
                            else if (payload.commodity.ToLower().Trim() == "electric")
                            {
                                searchedFiles = fileInfos.Where(f => f.FullName.ToUpper().IndexOf("G_M_AND_S") < 0 && f.FullName.ToLower().IndexOf("g_reg_plate") < 0 && f.FullName.ToLower().IndexOf("steam") < 0).ToList();
                                selectedFiles = searchedFiles.Skip(skipCount).Take(fileCount).ToList();
                            }
                            else
                            {
                                searchedFiles = fileInfos.ToList();
                                selectedFiles = fileInfos.Skip(skipCount).Take(fileCount).ToList();
                            }
                        }
                        else
                        {
                            searchedFiles = fileInfos.ToList();
                            selectedFiles = fileInfos.Skip(skipCount).Take(fileCount).ToList();
                        }
                        _logger.LogInformation("Filtered Commodity Files ::" + searchedFiles.Count());
                        if (selectedFiles != null && selectedFiles.Count > 0)
                        {
                            fileNames = so == SearchOption.TopDirectoryOnly ? selectedFiles.Select(l => l.Name).ToList() : selectedFiles.Select(l => l.FullName).ToList();
                            int totalFileCount = searchedFiles.Count();
                            double pageCount = Math.Ceiling(Convert.ToDouble(totalFileCount) / fileCount);
                            pageCount = pageCount <= 0 ? 1 : pageCount;

                            fileResult.filePath = payload.filePath;

                            fileResult.totalFiles = totalFileCount.ToString();
                            fileResult.pageIndex = pageIndex.ToString();
                            fileResult.pageCount = pageCount.ToString();
                            fileResult.countPerPage = fileCount.ToString();
                            fileResult.region = payload.region;
                            fileResult.commodity = payload.commodity;
                            _logger.LogInformation("Selected Files ::" + selectedFiles.Count());
                            // fileResult carries user-derived fields (filePath/region/commodity); sanitize the serialized output.
                            _logger.LogInformation("{result}", SanitizeLogData(JsonConvert.SerializeObject(fileResult)));

                            fileNames = GetPageTemplate(fileNames, payload.pageTemplate == "true");

                            fileResult.fileNames = fileNames;
                            msg = "Search Completed";
                        }
                        else
                        {
                            _logger.LogInformation("Selected Files ::" + selectedFiles.Count());
                        }
                    }
                }
                _logger.LogInformation(msg);
            }
            catch (UnauthorizedAccessException)
            {
                fileResult.error = "Invalid file path.";
                _logger.LogWarning("SearchFiles rejected a path outside the allowed root.");
            }
            catch (Exception ex)
            {
                fileResult.error = ex.Message;
                _logger.LogError($"Error: {ex}", fileResult.error);
            }
            finally
            {
                _logger.LogInformation("********************************************************************************");
            }

            return fileResult;
        }

        [HttpPost]
        [Authorize]
        [Route("PDFFile")]
        public byte[] GetPDFFile([FromBody] FilesPayload payload)
        {
            byte[] pdfData = null;

            try
            {
                _logger.LogInformation("********************************************************************************");
                _logger.LogInformation("Getting PDF File");
                string reqUserId = _httpContextAccessor.HttpContext.User.Identity.Name;
                LogAppUsage(reqUserId, payload);
                // LOG-FORGING: sanitize user-derived values before logging.
                _logger.LogInformation("User :: {user}", SanitizeLogData(reqUserId));
                _logger.LogInformation("{payload}", SanitizeLogData(JsonConvert.SerializeObject(payload)));

                if (payload == null || string.IsNullOrWhiteSpace(payload.fileName))
                {
                    _logger.LogWarning("Missing fileName in payload.");
                    return null;
                }

                string folder = payload.filePath ?? string.Empty;

                string namePart = payload.fileName.ToUpper().Trim().Replace(".PDF", "");
                if (!string.IsNullOrEmpty(folder))
                {
                    namePart = namePart.Replace(folder.ToUpper().Trim(), "");
                }
                string relativePath = folder + "\\" + namePart + ".PDF";

                string filePath = NormalizeAndValidatePath(GlobalVars.PDF_File_Path, relativePath);

                _logger.LogInformation("File Path :: {filePath}", SanitizeLogData(filePath));
                if (System.IO.File.Exists(filePath))
                {
                    _logger.LogInformation("Reading PDF File :: {filePath}", SanitizeLogData(filePath));

                    pdfData = System.IO.File.ReadAllBytes(filePath);
                    _logger.LogInformation("Reading PDF File - completed :: {filePath}", SanitizeLogData(filePath));
                }
            }
            catch (UnauthorizedAccessException)
            {
                _logger.LogWarning("GetPDFFile rejected a path outside the allowed root.");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error: {ex}", ex.Message);
            }
            finally
            {
                _logger.LogInformation("********************************************************************************");
            }
            return pdfData;
        }

        private List<string> GetPageTemplate(List<string> fileNameList, bool checkForPageTemplate = false)
        {
            List<string> result = new List<string>();
            List<string> pageTempateParts = new List<string>();
            List<string> newPageTemplateParts = new List<string>();
            List<string> pageSizeParts = new List<string>();
            string newFileName = string.Empty;
            Maptemplate mapTemplate;

            try
            {
                _logger.LogInformation("Checking for Page Template Info");
                foreach (string fileName in fileNameList)
                {
                    newFileName = fileName.Replace(GlobalVars.PDF_File_Path.Trim(), "", StringComparison.OrdinalIgnoreCase).Replace(".PDF", "", StringComparison.OrdinalIgnoreCase).Trim();
                    if (checkForPageTemplate)
                    {
                        _logger.LogInformation("Getting Page Template Info");
                        newPageTemplateParts = new List<string>();
                        newPageTemplateParts.Add(newFileName);

                        mapTemplate = _mapsContext.Maptemplates.Where(m => fileName.ToLower().Replace(".pdf", "").Trim() == m.Mapid.ToLower().Trim()).FirstOrDefault();
                        if (mapTemplate != null && mapTemplate.Pagetemplate != null)
                        {
                            //Get Page Size
                            if (mapTemplate.Pagetemplate.ToLower().IndexOf("size") >= 0)
                            {
                                newPageTemplateParts.Add("| ANSI");
                                pageTempateParts = mapTemplate.Pagetemplate.ToLower().Split("size", StringSplitOptions.RemoveEmptyEntries).ToList();
                                pageSizeParts = pageTempateParts[0].Split('_', StringSplitOptions.RemoveEmptyEntries).ToList();
                                if (pageSizeParts.Count > 1)
                                {
                                    newPageTemplateParts.Add(pageSizeParts[1].ToUpper());
                                    newPageTemplateParts.Add("size");
                                }
                            }
                            else
                            {
                                newPageTemplateParts.Add("|");
                                pageTempateParts = mapTemplate.Pagetemplate.Split('_', StringSplitOptions.RemoveEmptyEntries).ToList();
                                if (pageTempateParts.Count > 1)
                                {
                                    pageSizeParts = pageTempateParts[1].Split('(', StringSplitOptions.RemoveEmptyEntries).ToList();
                                    if (pageSizeParts.Count > 1)
                                    {
                                        newPageTemplateParts.Add(pageSizeParts[1].ToUpper().Replace("*", "x", StringComparison.OrdinalIgnoreCase).Replace(")", ""));
                                    }
                                    pageTempateParts[1] = pageSizeParts[0];
                                }
                            }
                            //Get Page orientation
                            if (pageTempateParts.Count > 1)
                            {
                                newPageTemplateParts.Add("-");
                                newPageTemplateParts.Add(pageTempateParts[1].ToUpper()
                                    .Replace("P", "Portrait", StringComparison.OrdinalIgnoreCase)
                                    .Replace("L", "Landscape", StringComparison.OrdinalIgnoreCase)
                                    .Replace("_", "")
                                    );
                            }
                        }
                        else
                        {
                            newPageTemplateParts.Add("| ANSI");
                            newPageTemplateParts.Add(GlobalVars.Default_Page_Size);
                        }

                        result.Add(string.Join(" ", newPageTemplateParts));
                    }
                    else
                    {
                        result.Add(newFileName);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error: {ex}", ex.Message);
            }

            return result;
        }

        private IEnumerable<FileInfo> EnumerateFiles(string path, string searchPattern, SearchOption searchOpt)
        {
            List<FileInfo> files = new List<FileInfo>() { };
            try
            {
                string boundary = Path.GetFullPath(path);
                string boundaryWithSep = boundary.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;

                if (searchOpt == SearchOption.TopDirectoryOnly)
                {
                    DirectoryInfo directoryInfo = new DirectoryInfo(boundary);
                    if (directoryInfo != null)
                    {
                        try
                        {
                            foreach (var file in directoryInfo.EnumerateFiles(searchPattern, searchOpt))
                            {
                                files.Add(file);
                            }
                        }
                        catch (UnauthorizedAccessException ex)
                        {
                            // Failed to read a File, skipping it.
                            _logger.LogError($"Error: {ex}", ex.Message);
                        }
                    }
                }
                else
                {
                    List<string> folders = new List<string>() { boundary };
                    int folCount = 1;

                    for (int i = 0; i < folCount; i++)
                    {
                        try
                        {
                            foreach (var newDir in Directory.EnumerateDirectories(folders[i], "*", SearchOption.TopDirectoryOnly))
                            {
                                string safeDir = Path.GetFullPath(newDir);
                                if (!safeDir.StartsWith(boundaryWithSep, StringComparison.OrdinalIgnoreCase))
                                {
                                    _logger.LogWarning("Skipped a subdirectory outside the search boundary.");
                                    continue;
                                }

                                folders.Add(safeDir);
                                folCount++;
                                DirectoryInfo directoryInfo = new DirectoryInfo(safeDir);
                                if (directoryInfo != null)
                                {
                                    try
                                    {
                                        foreach (var file in directoryInfo.EnumerateFiles(searchPattern))
                                        {
                                            files.Add(file);
                                        }
                                    }
                                    catch (UnauthorizedAccessException ex)
                                    {
                                        // Failed to read a File, skipping it.
                                        _logger.LogError($"Error: {ex}", ex.Message);
                                    }
                                }
                            }
                        }
                        catch (UnauthorizedAccessException ex)
                        {
                            // Failed to read a Folder, skipping it.
                            _logger.LogError($"Error: {ex}", ex.Message);
                            continue;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error: {ex}", ex.Message);
            }

            return files;
        }
        private void LogAppUsage(string userId, FilesPayload payload)
        {
            try
            {
                List<string> pageDetails = new List<string>();
                if (payload != null)
                {
                    if (!string.IsNullOrEmpty(payload.filePath))
                    {
                        pageDetails.Add(payload.filePath.Replace("/", "\\"));
                    }
                    else
                    {
                        if (!string.IsNullOrEmpty(payload.commodity))
                        {
                            pageDetails.Add(payload.commodity);
                        }
                        if (!string.IsNullOrEmpty(payload.region))
                        {
                            pageDetails.Add(payload.region);
                        }
                    }

                    if (!string.IsNullOrEmpty(payload.fileName))
                    {
                        pageDetails.Add(payload.fileName);
                    }
                }
                EgisAppUsage appUsage = new EgisAppUsage();
                appUsage.AppName = GlobalVars.appName.Trim();
                appUsage.Environment = GlobalVars.environment;
                appUsage.ConnectedDate = DateTime.Now;
                appUsage.UserName = userId.ToLower().Replace("coned\\", string.Empty);
                appUsage.MachineName = GlobalVars.serverName;
                appUsage.Page = string.Join("\\", pageDetails);
                _uftContext.EgisAppUsages.Add(appUsage);
                _uftContext.SaveChanges();
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to save login info to DB:: " + SanitizeLogData(userId));
            }
        }

        private static string NormalizeAndValidatePath(string basePath, string relativePath)
        {
            if (string.IsNullOrWhiteSpace(basePath))
            {
                throw new ArgumentException("Base path is required");
            }

            relativePath ??= string.Empty;

            var fullBasePath = Path.GetFullPath(basePath);

            var combinedPath = Path.GetFullPath(Path.Combine(fullBasePath, relativePath));

            if (!combinedPath.StartsWith(
                    fullBasePath.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar,
                    StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(combinedPath,
                    fullBasePath,
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("Invalid path detected.");
            }

            return combinedPath;
        }

        private static string SanitizeLogData(string input)
        {
            return input?
                .Replace("\r", "")
                .Replace("\n", "");
        }
    }
}
