namespace MapsAPI.Models
{
    public class FilesPayload
    {
        public string commodity { get; set; }
        public string region { get; set; }
        public string fileName { get; set; }
        public string filePath { get; set; }
        public string fileFormat { get; set; }
        public string fileCount { get; set; }
        public string pageIndex { get; set; }
        public string includeSubFolders { get; set; }
        public string pageTemplate { get; set; }
    }
}
