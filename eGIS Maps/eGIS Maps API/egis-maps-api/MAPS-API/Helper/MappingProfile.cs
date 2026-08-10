using AutoMapper;
using MapsAPI.Entities.Microstation;
using MapsAPI.Models;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using System.Diagnostics.Metrics;

namespace MapsAPI.Helper
{
    public class MappingProfile :Profile
    {
        public MappingProfile()
        {
            CreateMap<LayoutLog, LayoutnumLog>().ReverseMap();
        }
    }
}
