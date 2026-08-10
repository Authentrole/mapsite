using MapsAPI.Contexts;
using MapsAPI.Entities.eGIS;
using MapsAPI.Entities.Microstation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MapsAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class eGISController : ControllerBase
    {
        private readonly ILogger<eGISController> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly EgisDBContext _egisDBContext;
        public eGISController(IHttpContextAccessor httpContextAccessor, EgisDBContext egisDBContext, ILogger<eGISController> logger)
        {
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            _egisDBContext = egisDBContext;
        }

        [HttpGet]
        [Route("Regions")]
        public async Task<ActionResult<IEnumerable<EgisRegion>>> GetRegions()
        {
            return await _egisDBContext.EgisRegions.ToListAsync();
        }
    }
}
