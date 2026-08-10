using eGIS.Util;
using MapsAPI;
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
        private readonly ModelContext _context;
        private readonly ILogger<AccessController> _logger;

        public AccessController(IHttpContextAccessor httpContextAccessor, ModelContext context, ILogger<AccessController> logger)
        {
            _httpContextAccessor = httpContextAccessor;
            _context = context;
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
                _logger.LogInformation("********************************************************************************");
                _logger.LogInformation("Authentication Started");

                reqUserId = _httpContextAccessor.HttpContext.User.Identity.Name;
                _logger.LogInformation("User :: " + reqUserId);

                if (!string.IsNullOrEmpty(reqUserId))
                {
                    reqUserId = reqUserId.Trim();
                    ADUser adUser = ADUtil.GetADUser(reqUserId);
                    if (adUser != null)
                    {
                        if (!string.IsNullOrEmpty(adUser.AD_SAMACCOUNTNAME))
                        {
                            authUser.UserName = adUser.AD_FULLNAME;
                        }
                        else
                        {
                            authUser.UserName = reqUserId.ToUpper().Trim().Replace("CONED\\", string.Empty);
                        }

                        //Check if user is OPeraltional user
                        if (GlobalVars.Consider_AD_Group)
                        {
                            string adGroupsTocheck = GlobalVars.OPS_AD_Groups + "," + GlobalVars.Non_Ops_AD_Grooups;
                            foreach (string adGroup in adGroupsTocheck.Split(',',StringSplitOptions.RemoveEmptyEntries))
                            {
                                if (ADUtil.HasUserAdGroups(adUser.AD_GROUPS, adGroup))
                                {
                                    authUser.UserID = reqUserId;
                                    authUser.IsOpsUser = true;
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

                        //if Non-ops user chack for access granted or not
                        if (string.IsNullOrEmpty(authUser.UserID))
                        {
                            if (!string.IsNullOrEmpty(adUser.AD_SAMACCOUNTNAME))
                            {
                                authUser.UserID = reqUserId;                                
                                EgisAppUsersVw eGISUser = _context.EgisAppUsersVws.Where(e => e.Username.ToUpper().Trim() == reqUserId.ToUpper().Trim().Replace("CONED\\", string.Empty) && e.Appname.ToUpper().Trim() == "MAPS SITE").FirstOrDefault();
                                if (eGISUser == null)
                                {
                                    authUser.ErrorMSg = "User is not authorized";
                                }                                
                            }
                        }                        
                    }
                    else
                    {
                        authUser.ErrorMSg = "User is not authorized";
                    }
                }
                else
                {
                    authUser.ErrorMSg = "User is not authorized";
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

    }


    public class AuthResult
    {
        public string UserID { get; set; }
        public string UserName { get; set; }
        public string ErrorMSg { get; set; }
        public bool IsOpsUser { get; set; }
    }

    
}
