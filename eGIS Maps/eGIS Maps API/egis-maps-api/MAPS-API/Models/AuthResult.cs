using System.Collections.Generic;

namespace MapsAPI.Models
{
    public class AuthResult
    {
        public string UserID { get; set; }
        public string UserName { get; set; }
        public string ErrorMSg { get; set; }
        public bool IsOpsUser { get; set; }
        public List<string> UserGroups { get; set; }
    }
}
