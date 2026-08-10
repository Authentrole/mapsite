using AutoMapper;
using AutoMapper.QueryableExtensions;
using MapsAPI.Contexts;
using MapsAPI.Entities.eGIS;
using MapsAPI.Entities.Microstation;
using MapsAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace MapsAPI.Controllers
{
    [EnableCors("AllowOrigin")]
    [Route("api/[controller]")]
    [ApiController]
    public class LSNGController : ControllerBase
    {
        private readonly ILogger<LSNGController> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly EgisDBContext _egisContext;
        private readonly UFTDBContext _uftContext;
        private readonly MicrostationDBContext _microstationContext;
        private readonly IMapper _mapper;

        public LSNGController(IHttpContextAccessor httpContextAccessor, EgisDBContext egisContext, UFTDBContext uftContext, MicrostationDBContext microStationContext, IMapper mapper, ILogger<LSNGController> logger)
        {
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            _egisContext = egisContext;
            _uftContext = uftContext;
            _microstationContext = microStationContext;
            _mapper = mapper;
        }

        [HttpGet]
        [Authorize]
        [Route("Networks")]
        public async Task<ActionResult<IEnumerable<NetworkName>>> GetNetworks()
        {
            return await _microstationContext.NetworkNames.AsNoTracking().ToListAsync();
        }

        [HttpGet]
        [Authorize]
        [Route("Municipals")]
        public async Task<ActionResult<IEnumerable<Municipal>>> GetMunicipals()
        {
            return await _microstationContext.Municipals.AsNoTracking().ToListAsync();
        }

        [HttpGet]
        [Authorize]
        [Route("LayoutTypes")]
        public async Task<ActionResult<IEnumerable<LayoutType>>> GetLayoutTypes()
        {
            return await _microstationContext.LayoutTypes.AsNoTracking().ToListAsync();
        }

        [HttpGet]
        [Authorize]
        [Route("LayoutClasses")]
        public async Task<ActionResult<IEnumerable<LayoutNextseqBase>>> GetLayoutClasses()
        {
            return await _microstationContext.LayoutNextseqBases.AsNoTracking().ToListAsync();
        }

        [HttpPost]
        [Authorize]
        [Route("LayoutSequences")]
        public async Task<ActionResult<IEnumerable<LayoutSequence>>> GetLayoutSequences([FromBody] LayoutPayload payload)
        {
            List<LayoutSequence> layoutSequences = new List<LayoutSequence>();
            try
            {
                _logger.LogInformation("********************************************************************************");
                _logger.LogInformation("Getting Layout Sequences");
                string reqUserId = _httpContextAccessor.HttpContext.User.Identity.Name;
                // LOG-FORGING: strip CR/LF from user-derived values before logging.
                _logger.LogInformation("User :: {user}", SanitizeLogData(reqUserId));
                _logger.LogInformation("{payload}", SanitizeLogData(JsonConvert.SerializeObject(payload)));

                List<LayoutLog> layoutLogs = GetLayoutLogs(payload);

                layoutSequences = layoutLogs.Select(l => new LayoutSequence() { LayoutNumber = l.LayoutNum, LayoutSeqNum = l.LayoutSeqnum, LayoutPart = l.LayoutNum.Split(l.LayoutSeqnum + "-", StringSplitOptions.RemoveEmptyEntries)[1].Substring(0, 3) }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogInformation("Error:: Failed to get layout sequences " + ex.Message);
            }
            finally
            {
                _logger.LogInformation("{result}", SanitizeLogData(JsonConvert.SerializeObject(layoutSequences)));
                _logger.LogInformation("********************************************************************************");
            }

            return layoutSequences;
        }

        [HttpPost]
        [Authorize]
        [Route("LayoutCount")]
        public async Task<ActionResult<LayoutResponse>> GetLayoutCount([FromBody] LayoutPayload payload)
        {
            int layoutCount = 1000;
            LayoutResponse layoutResponse = new LayoutResponse();
            try
            {
                _logger.LogInformation("********************************************************************************");
                _logger.LogInformation("Getting Layout Number count");
                string reqUserId = _httpContextAccessor.HttpContext.User.Identity.Name;
                _logger.LogInformation("User :: {user}", SanitizeLogData(reqUserId));
                _logger.LogInformation("{payload}", SanitizeLogData(JsonConvert.SerializeObject(payload)));

                LayoutNextseqBase currentLayoutClassSeqBase = null;
                List<LayoutNextseqBase> layoutClassSeqBases = await _microstationContext.LayoutNextseqBases.ToListAsync();
                if (!string.IsNullOrEmpty(payload.Division))
                {
                    layoutClassSeqBases = layoutClassSeqBases.Where(l => l.Division == payload.Division).OrderBy(s => s.InitSeq).ToList();
                }
                if (layoutClassSeqBases.Count > 1)
                {
                    if (!string.IsNullOrEmpty(payload.LayoutClass))
                    {
                        currentLayoutClassSeqBase = layoutClassSeqBases.Where(l => l.LayoutClass == payload.LayoutClass).FirstOrDefault();
                    }

                    if (currentLayoutClassSeqBase != null)
                    {
                        int curLayoutClassInd = layoutClassSeqBases.IndexOf(currentLayoutClassSeqBase);
                        if (curLayoutClassInd < (layoutClassSeqBases.Count - 1))
                        {
                            int nextLayoutClassInd = curLayoutClassInd + 1;
                            LayoutNextseqBase nextLayoutClassSeqBase = layoutClassSeqBases[nextLayoutClassInd];
                            LayoutNextseqYear layoutCurSeq = GetCurrentLayoutSequence(payload);

                            layoutCount = layoutCurSeq != null ? nextLayoutClassSeqBase.InitSeq - layoutCurSeq.CurrentSeq : nextLayoutClassSeqBase.InitSeq - currentLayoutClassSeqBase.InitSeq;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogInformation("Error:: Failed to get layout count " + ex.Message);
                layoutResponse.ErrorMessage = "Failed to get layout count. Please contact administrator.";
            }
            finally
            {
                layoutResponse.LayoutCount = layoutCount;
                _logger.LogInformation("Layout Number count::" + layoutCount);
                _logger.LogInformation("********************************************************************************");
            }

            return layoutResponse;
        }

        [HttpPost]
        [Authorize]
        [Route("layoutHistory")]
        public async Task<ActionResult<IEnumerable<LayoutHistory>>> GetLayoutHistory([FromBody] LayoutPayload payload)
        {
            List<LayoutLog> layoutLogs = null;
            List<LayoutHistory> resultData = new List<LayoutHistory>();
            try
            {
                _logger.LogInformation("********************************************************************************");
                _logger.LogInformation("Getting Layout History");
                string reqUserId = _httpContextAccessor.HttpContext.User.Identity.Name;
                _logger.LogInformation("User :: {user}", SanitizeLogData(reqUserId));
                _logger.LogInformation("{payload}", SanitizeLogData(JsonConvert.SerializeObject(payload)));

                layoutLogs = GetLayoutLogs(payload);

                if (layoutLogs != null)
                {
                    try
                    {
                        var appUsageDetails = from t1 in layoutLogs
                                              from t2 in _egisContext.UamUsersEdws
                                                  .Where(x => (!string.IsNullOrEmpty(x.AliasName) && x.AliasName.ToLower().Replace("_", " ").Replace("-", " ").Trim() == t1.LayoutnumCreatedBy.ToLower().Replace("_", " ").Replace("-", " ").Trim())
                                                  || x.EmailAddressCompany.ToLower().Trim().Contains(t1.LayoutnumCreatedBy.ToLower().Trim()))
                                                  .DefaultIfEmpty().ToList()
                                              select new LayoutHistory
                                              {
                                                  LayoutnumLog = t1,
                                                  UserInfo = t2
                                              };

                        resultData = (List<LayoutHistory>)appUsageDetails.ToList();
                    }
                    catch
                    {
                        var appUsageDetails = from t1 in layoutLogs.ToList()
                                              select new LayoutHistory
                                              {
                                                  LayoutnumLog = t1
                                              };

                        resultData = (List<LayoutHistory>)appUsageDetails.ToList();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogInformation("Error:: Failed to get layout sequences " + ex.Message);
            }
            finally
            {
                _logger.LogInformation("{result}", SanitizeLogData(JsonConvert.SerializeObject(layoutLogs)));
                _logger.LogInformation("********************************************************************************");
            }

            return resultData;
        }

        [HttpPost]
        [Authorize]
        [Route("LayoutNumber")]
        public async Task<ActionResult<LayoutResponse>> GenerateLayoutNumber([FromBody] LayoutPayload payload)
        {
            string layoutNumber = string.Empty;
            List<string> layoutNumberList = new List<string>();
            LayoutResponse layoutResponse = new LayoutResponse();

            try
            {
                _logger.LogInformation("********************************************************************************");
                _logger.LogInformation("Generating Layout Number");
                string reqUserId = _httpContextAccessor.HttpContext.User.Identity.Name;
                LogAppUsage(reqUserId);
                _logger.LogInformation("User :: {user}", SanitizeLogData(reqUserId));
                _logger.LogInformation("{payload}", SanitizeLogData(JsonConvert.SerializeObject(payload)));
                reqUserId = reqUserId.ToLower().Replace("coned\\", "");

                string sectionNum = string.Empty;
                var userDetail = _egisContext.UamUsersEdws.Where(u => u.AliasName.ToLower().Trim() == reqUserId.ToLower().Trim() || u.EmailAddressCompany.ToLower().Trim().Contains(reqUserId.ToLower().Trim())).Select(u => u.SectCd).FirstOrDefault();
                sectionNum = userDetail.ToString();

                int seqNumber = 0;
                string part = "000";
                if (string.IsNullOrEmpty(payload.Part))
                {
                    _logger.LogInformation("Case: Adding new sequence");
                    _logger.LogInformation("Getting the current sequence number");
                    LayoutNextseqYear layoutCurSeq = GetCurrentLayoutSequence(payload);
                    if (layoutCurSeq == null)
                    {
                        LayoutNextseqBase currentLayoutClassSeqBase = null;
                        List<LayoutNextseqBase> layoutClassSeqBases = await _microstationContext.LayoutNextseqBases.AsNoTracking().ToListAsync();
                        if (!string.IsNullOrEmpty(payload.Division))
                        {
                            layoutClassSeqBases = layoutClassSeqBases.Where(l => l.Division == payload.Division).OrderBy(s => s.InitSeq).ToList();
                        }

                        if (!string.IsNullOrEmpty(payload.LayoutClass))
                        {
                            currentLayoutClassSeqBase = layoutClassSeqBases.Where(l => l.LayoutClass == payload.LayoutClass).FirstOrDefault();
                        }

                        if (currentLayoutClassSeqBase != null)
                        {
                            seqNumber = currentLayoutClassSeqBase.InitSeq;
                        }
                        _logger.LogInformation("Adding record in LAYOUT_NEXT_SEQ_YEAR table with Init_Seq value");
                        layoutCurSeq = new LayoutNextseqYear();
                        layoutCurSeq.Division = payload.Division;
                        layoutCurSeq.LayoutClass = payload.LayoutClass;
                        layoutCurSeq.LayoutYear = payload.Year;
                        layoutCurSeq.LastUser = reqUserId;
                        layoutCurSeq.LastUsedDate = DateTime.Now;
                        layoutCurSeq.CurrentSeq = seqNumber;
                        _microstationContext.LayoutNextseqYears.Add(layoutCurSeq);
                    }
                    else
                    {
                        _logger.LogInformation("Updating exiting record in LAYOUT_NEXT_SEQ_YEAR table with incrementing the current seq by 1");
                        seqNumber = layoutCurSeq.CurrentSeq + 1;

                        layoutCurSeq.CurrentSeq = seqNumber;
                        layoutCurSeq.LastUser = reqUserId;
                        layoutCurSeq.LastUsedDate = DateTime.Now;
                        _microstationContext.Entry(layoutCurSeq).State = EntityState.Modified;
                    }
                }
                else
                {
                    _logger.LogInformation("Case: Ading the new part");
                    seqNumber = payload.Sequence;
                    part = payload.Part;
                }

                _logger.LogInformation("Adding record in LAYOUT_NUM_LOG table with new Layout number");
                string municipal = string.Empty;
                municipal = !string.IsNullOrEmpty(payload.Municipal) ? payload.Municipal : payload.Division;

                if (!string.IsNullOrEmpty(payload.Part))
                {
                    List<LayoutLog> layoutLogs = GetLayoutLogs(payload);

                    List<LayoutnumLog> layoutNumLogs = _mapper.Map<List<LayoutnumLog>>(layoutLogs);

                    if (layoutNumLogs.Count < _microstationContext.LayoutnumLogs.AsNoTracking().Count())
                    {
                        foreach (var layoutLog in layoutNumLogs)
                        {
                            layoutLog.WrNum = payload.WrNumber;
                            _microstationContext.Entry(layoutLog).State = EntityState.Modified;
                        }
                    }
                    if (layoutLogs.Count > 0)
                    {
                        part = (Convert.ToInt32(layoutLogs.OrderByDescending(l => l.LayoutNum).FirstOrDefault().LayoutNum.Split(seqNumber + "-", StringSplitOptions.RemoveEmptyEntries)[1].Substring(0, 3)) + 1).ToString("D3");
                    }
                }

                for (int partInd = 1; partInd <= payload.PartCount; partInd++)
                {
                    layoutNumber = payload.LayoutType + (payload.Year % 100).ToString() + "-" + seqNumber + "-" + part + municipal;
                    layoutNumberList.Add(layoutNumber);
                    LayoutnumLog layoutLog = new LayoutnumLog();
                    layoutLog.Division = payload.Division;
                    layoutLog.LayoutClass = payload.LayoutClass;
                    layoutLog.LayoutType = payload.LayoutType;
                    layoutLog.LayoutSeqnum = seqNumber;
                    layoutLog.LayoutNum = layoutNumber;
                    layoutLog.McNum = payload.McNumber;
                    layoutLog.SectionNum = sectionNum;
                    layoutLog.EventNum = payload.EventNumber;
                    layoutLog.WrNum = payload.WrNumber;
                    layoutLog.NetworkId = payload.Network;
                    layoutLog.LayoutnumCreatedDate = DateTime.Now;
                    layoutLog.LayoutnumCreatedBy = reqUserId;
                    layoutLog.LayoutApp = payload.LayoutApp;
                    _microstationContext.LayoutnumLogs.Add(layoutLog);
                    part = (Convert.ToInt32(part) + 1).ToString("D3");
                }

                try
                {
                    _logger.LogInformation("Saving changes to DB");
                    await _microstationContext.SaveChangesAsync();
                    // layoutNumberList is built from payload values; sanitize before logging.
                    _logger.LogInformation("Layout Number(s) Generated::{layouts}", SanitizeLogData(string.Join(", ", layoutNumberList)));
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    _logger.LogInformation("Error: Failed to saving changes to DB" + ex.Message);
                    layoutResponse.ErrorMessage = "Failed to generate layout number. Please contact administrator.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogInformation("Error: Failed to generate Layout Number" + ex.Message);
                layoutResponse.ErrorMessage = "Failed to generate layout number. Please contact administrator.";
            }
            finally
            {
                layoutResponse.LayoutNumbers = layoutNumberList;
                _logger.LogInformation("********************************************************************************");
            }

            return layoutResponse;
        }

        private LayoutNextseqYear GetCurrentLayoutSequence(LayoutPayload payload)
        {
            LayoutNextseqYear layoutCurSeq = null;
            try
            {
                List<LayoutNextseqYear> layoutCurSeqs = _microstationContext.LayoutNextseqYears.AsNoTracking().ToList();
                if (!string.IsNullOrEmpty(payload.Division))
                {
                    layoutCurSeqs = layoutCurSeqs.Where(l => l.Division == payload.Division).ToList();
                }

                if (!string.IsNullOrEmpty(payload.LayoutClass))
                {
                    layoutCurSeqs = layoutCurSeqs.Where(l => l.LayoutClass == payload.LayoutClass).ToList();
                }

                if (payload.Year > 0)
                {
                    layoutCurSeqs = layoutCurSeqs.Where(l => l.LayoutYear == payload.Year).ToList();
                }
                layoutCurSeq = layoutCurSeqs.FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError("Error: While getting current sequence number " + ex.Message);
            }

            return layoutCurSeq;
        }

        private void LogAppUsage(string userId)
        {
            try
            {
                EgisAppUsage appUsage = new EgisAppUsage();
                appUsage.AppName = GlobalVars.appName.Trim();
                appUsage.Environment = GlobalVars.environment;
                appUsage.ConnectedDate = DateTime.Now;
                appUsage.UserName = userId.ToLower().Replace("coned\\", string.Empty);
                appUsage.MachineName = GlobalVars.serverName;
                appUsage.Page = "LSNG";
                _uftContext.EgisAppUsages.Add(appUsage);
                _uftContext.SaveChanges();
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to save LSNG usage info to DB:: {user}", SanitizeLogData(userId));
            }
        }

        private List<LayoutLog> GetLayoutLogs(LayoutPayload payload)
        {
            List<LayoutLog> layoutLogList = null;
            string layoutType = string.Empty;
            try
            {
                var layoutLogs = _microstationContext.LayoutnumLogs.AsNoTracking();

                if (!string.IsNullOrEmpty(payload.Division))
                {
                    layoutLogs = layoutLogs.Where(l => l.Division.Trim() == payload.Division.Trim());
                }

                if (!string.IsNullOrEmpty(payload.LayoutClass))
                {
                    layoutLogs = layoutLogs.Where(l => l.LayoutClass.Trim() == payload.LayoutClass.Trim());
                }

                if (!string.IsNullOrEmpty(payload.LayoutType))
                {
                    layoutLogs = layoutLogs.Where(l => l.LayoutType.Trim() == payload.LayoutType.Trim());
                    layoutType = payload.LayoutType.Trim();
                }

                if (payload.Sequence != 0)
                {
                    layoutLogs = layoutLogs.Where(l => l.LayoutSeqnum == payload.Sequence);
                }

                if (!string.IsNullOrEmpty(payload.SectionNumber))
                {
                    layoutLogs = layoutLogs.Where(l => l.SectionNum.Trim() == payload.SectionNumber.Trim());
                }

                layoutLogList = layoutLogs.ProjectTo<LayoutLog>(_mapper.ConfigurationProvider).ToList();
                if (payload.Year != 0)
                {
                    layoutLogList = layoutLogList.Where(l => l.LayoutNum.IndexOf(layoutType + (payload.Year % 100).ToString() + "-", 0, 4) >= 0).ToList();
                }
            }
            catch (Exception ex)
            {
            }
            return layoutLogList;
        }

        private static string SanitizeLogData(string input)
        {
            return input?
                .Replace("\r", "")
                .Replace("\n", "");
        }
    }
}
