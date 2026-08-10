using System;
using System.Collections.Generic;
using System.DirectoryServices;
using System.DirectoryServices.AccountManagement;


namespace eGIS.Util
{
    public class ADUtil
    {
        public static bool IsInGroup(string ingroup, string sUserName,out string fullName)
        {

            bool isMember = false;

            fullName = string.Empty;

            try
            {

                PrincipalContext domainctx = new PrincipalContext(ContextType.Domain, "conedison.net");

                UserPrincipal userPrincipal = UserPrincipal.FindByIdentity(domainctx, IdentityType.SamAccountName, sUserName);
                if(userPrincipal != null)
                {
                    fullName = userPrincipal.DisplayName;
                    //GroupPrincipal oGroup = GroupPrincipal.FindByIdentity(domainctx, ingroup);
                    //isMember = oGroup.Members.Contains(userPrincipal);
                    isMember = userPrincipal.IsMemberOf(domainctx, IdentityType.Name, ingroup);

                    Logger.Debug("===  IsMemberOf:[" + ingroup + "]....[" + isMember + "]", 1);
                }
                
            }
            catch (Exception e)
            {
                Logger.Error("SGUtil.IsInGroup. exception:");
                Logger.Error(e.Message, 1);
            }

            return isMember;
        }

        public static bool AddMembersToGroup(string sADGroup, string sUserName)
        {
            Logger.Debug("===  AddMembersToGroup:[" + sADGroup + "]....[" + sUserName + "]", 1);
            bool isMember = false;

            string username = sUserName;

            try
            {

                PrincipalContext domainctx = new PrincipalContext(ContextType.Domain, "conedison.net");//, "OU=Distribution Lists,OU=Temporary Exchange Accounts,DC=conedison,DC=net");

                UserPrincipal userPrincipal = UserPrincipal.FindByIdentity(domainctx, IdentityType.SamAccountName, username);

                GroupPrincipal oGroup = GroupPrincipal.FindByIdentity(domainctx, sADGroup);
                if (oGroup != null && userPrincipal != null)
                {
                    Logger.Debug(" found the group:[" + oGroup.Name + "]....", 1);
                    Logger.Debug(" found the User:[" + userPrincipal.Name + "]....", 1);
                    if (!oGroup.Members.Contains(userPrincipal))
                    {
                        oGroup.Members.Add(userPrincipal);
                        oGroup.Save();
                    }
                }
                          

                oGroup.Dispose();
                userPrincipal.Dispose();
                domainctx.Dispose();

                isMember = true;
            }
            catch (Exception e)
            {
                string sErr = "AddMembersToGroup. exception:" + e.Message;
                Logger.Error("*** Error: " + sErr, 1);

                isMember = false;
            }

            return isMember;
        }//public static bool AddMembersToGroup(string sADGroup, string sUserName)

        
        public static bool RemoveMemberFromGroup(string sADGroup, string sUserName)
        {
            Logger.Debug("===  RemoveMemberFromGroup:[" + sADGroup + "]....[" + sUserName + "]", 1);
            bool bRemoved = false;

            string username = sUserName;

            try
            {

                PrincipalContext domainctx = new PrincipalContext(ContextType.Domain, "conedison.net");//, "OU=Distribution Lists,OU=Temporary Exchange Accounts,DC=conedison,DC=net");

                UserPrincipal userPrincipal = UserPrincipal.FindByIdentity(domainctx, IdentityType.SamAccountName, username);

                GroupPrincipal oGroup = GroupPrincipal.FindByIdentity(domainctx, sADGroup);
                if(oGroup != null && userPrincipal != null)
                {
                    Logger.Debug(" found the group:[" + oGroup.Name + "]....", 1);
                    Logger.Debug(" found the User:[" + userPrincipal.Name + "]....", 1);
                    if (oGroup.Members.Contains(userPrincipal))
                    {
                        oGroup.Members.Remove(userPrincipal);
                        oGroup.Save();
                    }
                }
                                

                oGroup.Dispose();
                userPrincipal.Dispose();
                domainctx.Dispose();

                bRemoved = true;
            }
            catch (Exception e)
            {
                string sErr = "RemoveMemberFromGroup. exception:" + e.Message;
                Logger.Error("*** Error: " + sErr, 1);

                bRemoved = false;
            }

            return bRemoved;
        }//public static bool RemoveMemberFromGroup(string sADGroup, string sUserName)

        public static bool DE_AddMembersToGroup(string sADGroup, string sUserName)
        {
            Logger.Debug("===  DE_AddMembersToGroup:[" + sADGroup + "]....[" + sUserName + "]", 1);
            bool isMember = false;

            string username = sUserName;

            try
            {

                DirectoryEntry deGroup = new DirectoryEntry("LDAP://CN=DL - IT GCTX_DEV_ArcMap,OU=Distribution Lists,OU=Temporary Exchange Accounts,DC=conedison,DC=net");
                deGroup.Properties["member"].Add(sUserName);
                deGroup.CommitChanges();

                isMember = true;


            }
            catch (Exception e)
            {
                Logger.Error("SGUtil.DE_AddMembersToGroup. exception:");
                Logger.Error(e.Message, 1);
            }





            return isMember;
        }


        public static ADUser GetADUser(string userId,bool needGroups=true)
        {
            ADUser adUser = null;
            List<string>  userGroups=new List<string>();
            if (!string.IsNullOrEmpty(userId))
            {
                PrincipalContext domainctx = new PrincipalContext(ContextType.Domain, "CONED", "DC=conedison,DC=net");//, "OU=Distribution Lists,OU=Temporary Exchange Accounts,DC=conedison,DC=net");

                using (UserPrincipal userPrincipal = UserPrincipal.FindByIdentity(domainctx, IdentityType.SamAccountName, userId))
                {
                    if(userPrincipal != null)
                    {
                        adUser = new ADUser();
                        string middleName = string.IsNullOrEmpty(userPrincipal.MiddleName) ? " " : " " + userPrincipal.MiddleName + " ";
                        adUser.AD_FIRSTNAME = userPrincipal.GivenName;
                        adUser.AD_LASTNAME = userPrincipal.Surname;
                        adUser.AD_DISPLAYNAME = userPrincipal.DisplayName;
                        adUser.AD_FULLNAME = userPrincipal.GivenName + middleName + userPrincipal.Surname;
                        adUser.AD_EMPLOYEEID = userPrincipal.EmployeeId;
                        adUser.AD_EMAIL = userPrincipal.EmailAddress;
                        adUser.AD_SAMACCOUNTNAME = userPrincipal.SamAccountName;
                        if (needGroups)
                        {
                            PrincipalSearchResult<Principal> grps = userPrincipal.GetGroups(domainctx);

                            foreach (GroupPrincipal grpPrin in grps)
                            {
                                if (!string.IsNullOrEmpty(grpPrin.Name))
                                {
                                    userGroups.Add(grpPrin.Name.ToUpper().Trim());
                                }
                            }
                        }
                     

                        adUser.AD_GROUPS = userGroups;
                    }
                    
                }
                
                if(adUser == null)
                {
                    using (UserPrincipal userPrincipal = UserPrincipal.FindByIdentity(domainctx, (userId + "@coned.com").ToUpper()))
                    {
                        if (userPrincipal != null)
                        {
                            adUser = new ADUser();
                            string middleName = string.IsNullOrEmpty(userPrincipal.MiddleName) ? " " : " " + userPrincipal.MiddleName + " ";
                            adUser.AD_FIRSTNAME = userPrincipal.GivenName;
                            adUser.AD_LASTNAME = userPrincipal.Surname;
                            adUser.AD_DISPLAYNAME = userPrincipal.DisplayName;
                            adUser.AD_FULLNAME = userPrincipal.GivenName + middleName + userPrincipal.Surname;
                            adUser.AD_EMPLOYEEID = userPrincipal.EmployeeId;
                            adUser.AD_EMAIL = userPrincipal.EmailAddress;
                            adUser.AD_SAMACCOUNTNAME = userPrincipal.SamAccountName;
                            PrincipalSearchResult<Principal> grps = userPrincipal.GetGroups(domainctx);

                            foreach (GroupPrincipal grpPrin in grps)
                            {
                                if (!string.IsNullOrEmpty(grpPrin.Name))
                                {
                                    userGroups.Add(grpPrin.Name.ToUpper().Trim());
                                }
                            }

                            adUser.AD_GROUPS = userGroups;
                        }

                    }
                }

                domainctx.Dispose();
            }

            return adUser;
        }

        public static bool HasUserAdGroups(List<string> user_AdGroups, string appGroup)
        {
            bool hasAdGroups = false;
            try
            {
                if (user_AdGroups != null && (!string.IsNullOrEmpty(appGroup)))
                {
                    if (user_AdGroups.IndexOf(appGroup.ToUpper().Trim()) >= 0)
                    {
                        hasAdGroups = true;
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.Error("Error::error while verifying user groups...::" + ex.Message);
                hasAdGroups = false;
            }
            return hasAdGroups;
        }

    }//public class SGUtil
}
