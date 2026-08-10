using eGIS.Util;
using MapsAPI;
using MapsAPI.Contexts;
using MapsAPI.Entities.eGIS;
using MapsAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;


namespace MAPSAPI.Controllers
{
    [EnableCors("AllowOrigin")]
    [Route("api/[controller]")]
    [ApiController]
    public class AccessController : ControllerBase
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly EgisDBContext _context;
        private readonly UFTDBContext _uftContext;
        private readonly ILogger<AccessController> _logger;

        public AccessController(IHttpContextAccessor httpContextAccessor, EgisDBContext context, UFTDBContext uftContext, ILogger<AccessController> logger)
        {
            _httpContextAccessor = httpContextAccessor;
            _context = context;
            _uftContext = uftContext;
            _logger = logger;
        }

        [HttpGet]
        [Authorize]
        [Route("AuthenticateUser")]
        public AuthResult AuthenticateUser()
        {
            string reqUserId = string.Empty;            

            AuthResult authUser = new AuthResult();
            try
            {
                authUser.ErrorMSg = "User is not authorized";

                _logger.LogInformation("********************************************************************************");
                _logger.LogInformation("Authentication Started");

                reqUserId = _httpContextAccessor.HttpContext.User.Identity.Name;
                _logger.LogInformation("User :: " + reqUserId);

                if (!string.IsNullOrEmpty(reqUserId))
                {
                    reqUserId = reqUserId.Trim();
                    ADUser adUser = ADUtil.GetADUser(reqUserId,GlobalVars.Consider_AD_Group);
                    if (adUser != null)
                    {                      

                        //Check if user is OPeraltional user
                        if (GlobalVars.Consider_AD_Group)
                        {
                            string adGroupsTocheck = GlobalVars.App_AD_Group;//GlobalVars.OPS_AD_Groups + "," + GlobalVars.Non_Ops_AD_Grooups;
                            foreach (string adGroup in adGroupsTocheck.Split(',',StringSplitOptions.RemoveEmptyEntries))
                            {
                                if (ADUtil.HasUserAdGroups(adUser.AD_GROUPS, adGroup))
                                {
                                    //if (!string.IsNullOrEmpty(adUser.AD_SAMACCOUNTNAME))
                                    //{
                                    //    authUser.UserName = adUser.AD_FULLNAME;
                                    //}
                                    //else
                                    //{
                                    //    authUser.UserName = reqUserId.ToUpper().Trim().Replace("CONED\\", string.Empty);
                                    //}
                                    authUser.UserName = adUser.AD_FULLNAME;
                                    authUser.UserName = string.IsNullOrEmpty(authUser.UserName) ? reqUserId.ToUpper().Trim().Replace("CONED\\", string.Empty) : authUser.UserName;
                                    authUser.UserID = reqUserId;
                                    authUser.IsOpsUser = true;
                                    authUser.UserGroups = adUser.AD_GROUPS;
                                    authUser.ErrorMSg = "";
                                    LogAppUsage(reqUserId);                                    
                                    _logger.LogInformation("Operational / Exceptional User :: " + reqUserId);
                                    break;
                                }
                            }
                            //if (!authUser.IsOpsUser)
                            //{
                            //    foreach (string adGroup in GlobalVars.Non_Ops_AD_Grooups.Split(','))
                            //    {
                            //        if (ADUtil.HasUserAdGroups(adUser.AD_GROUPS, adGroup))
                            //        {
                            //            authUser.UserID = reqUserId;
                            //            authUser.IsOpsUser = false;
                            //            _logger.LogInformation("Non-Operational User :: " + reqUserId);
                            //            break;
                            //        }
                            //    }
                            //}

                        }
                        else
                        {
                            ////if Non-ops user chack for access granted or not
                            //if (string.IsNullOrEmpty(authUser.UserID))
                            //{
                            //    if (!string.IsNullOrEmpty(adUser.AD_SAMACCOUNTNAME))
                            //    {
                                    authUser.UserName = adUser.AD_FULLNAME;
                                    authUser.UserName = string.IsNullOrEmpty(authUser.UserName) ? reqUserId.ToUpper().Trim().Replace("CONED\\", string.Empty) : authUser.UserName;

                                    authUser.UserID = reqUserId;
                                    authUser.UserGroups = adUser.AD_GROUPS;
                                    EgisAppUsersVw eGISUser = _context.EgisAppUsersVws.Where(e => e.Username.ToUpper().Trim() == reqUserId.ToUpper().Trim().Replace("CONED\\", string.Empty) && e.Appname.ToUpper().Trim() == GlobalVars.appName.ToUpper().Trim()).FirstOrDefault();
                                    if (eGISUser != null)
                                    {
                                        authUser.ErrorMSg = "";
                                        LogAppUsage(reqUserId);
                                    }
                            //    }
                            //}
                        }                                              
                    }                    
                }
                
            }
            catch (Exception ex)
            {                               
                authUser.ErrorMSg = ex.Message;
                _logger.LogError($"Error: { ex }", ex.Message);
            }
            finally
            {
                if (string.IsNullOrEmpty(authUser.UserID))
                {
                    _logger.LogInformation("Authentication Failed");
                }
                else
                {
                    _logger.LogInformation("Authentication Success");
                }
                _logger.LogInformation("********************************************************************************");
            }
            return authUser;
        }

        private void LogAppUsage(string userId)
        {
            try
            {
                EgisAppUsage appUsage = new EgisAppUsage();
                appUsage.AppName = GlobalVars.appName.Trim();
                appUsage.Environment = GlobalVars.environment;
                appUsage.ConnectedDate = DateTime.Now;
                appUsage.UserName = userId.ToLower().Replace("coned\\",string.Empty);
                appUsage.MachineName = GlobalVars.serverName;
                _uftContext.EgisAppUsages.Add(appUsage);
                _uftContext.SaveChanges();
            }
            catch(Exception ex)
            {
                _logger.LogError("Failed to save login info to DB:: " + userId);
            }
            
        }
    }


    //public class AuthResult
    //{
       
    //}

       
}
