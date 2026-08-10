using System;
using System.Collections.Generic;
using System.DirectoryServices.AccountManagement;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using ConEdison.ADUtility;

namespace eGIS.Util
{
    public class ADUser
    {
        public bool USER_FOUND { get; set; }

        public const string CONED_DOMAIN_STRING = "CONED";
        public const string CONED_DOMAIN_CONTAINER = "DC=conedison,DC=net";

        public const string PROPNAME_SAMACCOUNTNAME = "samaccountname";
        public const string PROPNAME_LASTNAME = "sn";
        public const string PROPNAME_FIRSTNAME = "givenname";
        public const string PROPNAME_MININITIALSNAME = "midname";
        public const string PROPNAME_DISPLAYNAME = "displayname";
        public const string PROPNAME_DEPARTMENT = "department";
        public const string PROPNAME_TITLE = "title";
        public const string PROPNAME_EMAIL = "mail";
        public const string PROPNAME_COMPANY = "company";
        public const string PROPNAME_EMPLOYEEID = "employeeid";

        public string AD_SAMACCOUNTNAME { get; set; }
        public string AD_LASTNAME { get; set; }
        public string AD_FIRSTNAME { get; set; }
        public string AD_FULLNAME { get; set; }
        public string AD_DISPLAYNAME { get; set; }
        public string AD_DEPARTMENT { get; set; }
        public string AD_TITLE { get; set; }
        public string AD_EMAIL { get; set; }
        public string AD_COMPANY { get; set; }
        public string AD_EMPLOYEEID { get; set; }
        public List<string> AD_GROUPS { get; set; }



        private string ADSearchUserID { get; set; }

        public ADUser()
        {
        }

        public ADUser(string sUserID)
        {
            SearchADUser(sUserID);
        }

        public void SearchADUser(string sUserID)
        {

            ADSearchUserID = sUserID;

            Logger.Debug("Create new AD User: [" + ADSearchUserID + "]");

            loadCEUserAD();
        }




        private void loadCEUserAD()
        {
            Logger.Debug("loadCEUserAD: [" + ADSearchUserID + "]");
            try
            {

                ADHelper adUtil = new ADHelper();

                AD_SAMACCOUNTNAME = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_SAMACCOUNTNAME).ToLower();
                AD_LASTNAME = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_LASTNAME);
                AD_FIRSTNAME = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_FIRSTNAME);
                //AD_FULLNAME = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_MININITIALSNAME);
                AD_DISPLAYNAME = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_DISPLAYNAME);
                AD_DEPARTMENT = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_DEPARTMENT);
                AD_TITLE = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_TITLE);
                AD_EMAIL = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_EMAIL).ToLower();
                AD_COMPANY = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_COMPANY);
                AD_EMPLOYEEID = adUtil.GetUserInfo(ADSearchUserID, PROPNAME_EMPLOYEEID);

                Logger.Debug("AD_SAMACCOUNTNAME: [" + AD_SAMACCOUNTNAME + "]", 1);
                Logger.Debug("AD_LASTNAME: [" + AD_LASTNAME + "]", 1);
                Logger.Debug("AD_FIRSTNAME: [" + AD_FIRSTNAME + "]", 1);
                //Logger.Debug("AD_MININITIALSNAME: [" + AD_MININITIALSNAME + "]", 1);
                Logger.Debug("AD_DISPLAYNAME: [" + AD_DISPLAYNAME + "]", 1);
                Logger.Debug("AD_DEPARTMENT: [" + AD_DEPARTMENT + "]", 1);
                Logger.Debug("AD_TITLE: [" + AD_TITLE + "]", 1);
                Logger.Debug("AD_EMAIL: [" + AD_EMAIL + "]", 1);
                Logger.Debug("AD_COMPANY: [" + AD_COMPANY + "]", 1);
                Logger.Debug("AD_EMPLOYEEID: [" + AD_EMPLOYEEID + "]", 1);



                if (String.IsNullOrEmpty(AD_SAMACCOUNTNAME) || String.Equals(AD_SAMACCOUNTNAME, "NULL", StringComparison.OrdinalIgnoreCase)
                        || AD_SAMACCOUNTNAME.StartsWith("error:", StringComparison.OrdinalIgnoreCase))
                {
                    USER_FOUND = false;
                    Logger.Error("Domain user [" + ADSearchUserID + "] not found");

                }
                else
                    USER_FOUND = true;
            }
            catch (Exception err)
            {
                USER_FOUND = false;
                Logger.Error(err.Message);
            }
        }//public static void loadCEUserAD()


        public void AddUserToGroup(string groupName)
        {
            Logger.Debug("AddUserToGroup:....groupname[" + groupName + "]  userName[" + AD_SAMACCOUNTNAME + "]");
            string userName = System.Environment.UserDomainName + @"\" + AD_SAMACCOUNTNAME;

            try
            {
                using (UserPrincipal oUserPrincipal = GetUser(userName))
                {
                    Logger.Debug("found rToGroup:....groupname[" + groupName + "]  userName[" + userName + "]");

                    using (GroupPrincipal oGroupPrincipal = GetGroup(groupName))
                    {
                        if (oUserPrincipal != null || oGroupPrincipal != null)
                        {
                            if (!IsUserGroupMember(userName, groupName))
                            {
                                oGroupPrincipal.Members.Add(oUserPrincipal);
                                oGroupPrincipal.Save();
                            }
                        }
                        Logger.Debug("Add user to group:....: Success", 1);
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.Debug("Add user to group:....: failuer:  " + ex.Message, 1);
            }

        }

       


        public void RemoveUserFromGroup(string userId, string groupName)
        {
            try
            {
                using (PrincipalContext pc = new PrincipalContext(ContextType.Domain, "COMPANY"))
                {
                    GroupPrincipal group = GroupPrincipal.FindByIdentity(pc, groupName);
                    group.Members.Remove(pc, IdentityType.UserPrincipalName, userId);
                    group.Save();
                }
            }
            catch (System.DirectoryServices.DirectoryServicesCOMException E)
            {
                //doSomething with E.Message.ToString(); 

                Logger.Debug("Remove user["+userId+"] from group["+groupName+"]:....: failuer:  " + E.Message, 1);

            }
        }

        private GroupPrincipal GetGroup(string groupName)
        {
            GroupPrincipal oGroupPrincipal = null;
            try
            {
                PrincipalContext oPrincipalContext = GetPrincipalContext();
                if (oPrincipalContext != null)
                {
                    oGroupPrincipal = GroupPrincipal.FindByIdentity(oPrincipalContext, groupName);
                }
            }
            catch (Exception ex)
            {
                Logger.Error("GetGroupPrincipal Exception: " + ex.ToString());
            }

            return oGroupPrincipal;
        }//private GroupPrincipal GetGroup(string groupName)

        private PrincipalContext GetPrincipalContext()
        {
            PrincipalContext principalContext = null;

            try
            {
                principalContext = new PrincipalContext(ContextType.Domain, CONED_DOMAIN_STRING, CONED_DOMAIN_CONTAINER);
            }
            catch (Exception ex)
            {
                Logger.Error("GetPrincipalContext Exception: " + ex.ToString());
            }

            return principalContext;
        }//private PrincipalContext GetPrincipalContext()


        private UserPrincipal GetUser(string userName)
        {
            UserPrincipal oUserPrincipal = null;
            try
            {
                using (PrincipalContext oPrincipalContext = GetPrincipalContext())
                {
                    oUserPrincipal = UserPrincipal.FindByIdentity(oPrincipalContext, userName);
                }
            }
            catch (Exception ex)
            {
                Logger.Error("GetPrincipalContext Exception: " + ex.ToString());
            }

            return oUserPrincipal;
        }//private UserPrincipal GetUser(string userName)

        private bool IsUserGroupMember(string userName, string groupName)
        {
            bool isMember = false;
            try
            {
                using (UserPrincipal oUserPrincipal = GetUser(userName))
                {
                    using (GroupPrincipal oGroupPrincipal = GetGroup(groupName))
                    {
                        isMember = oGroupPrincipal.Members.Contains(oUserPrincipal);
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.Error("IsUserGroupMember Exception: " + ex.ToString());
            }

            return isMember;
        }//private bool IsUserGroupMember(string userName, string groupName)

    }//public class ADUser
}
