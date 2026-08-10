using System.Collections.Generic;

namespace MapsAPI.Models
{
    public class LayoutResponse
    {
        public int LayoutCount { get; set; }
        public List<string> LayoutNumbers { get; set; }
        public string ErrorMessage { get; set; }
    }
}
