using System.Collections.Generic;

namespace MapsAPI.Models
{
    public class FilesResult
    {
        public string commodity { get; set; }
        public string region { get; set; }
        public string totalFiles { get; set; }
        public string pageIndex { get; set; }
        public string pageCount { get; set; }
        public string countPerPage { get; set; }
        public string filePath { get; set; }
        public List<string> fileNames { get; set; }
        public string error { get; set; }
    }
}
