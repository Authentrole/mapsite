
using MapsAPI.Contexts;
using MapsAPI.Helper;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;
using Microsoft.OpenApi.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MapsAPI
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers();

            services.AddCors(options =>
            {
                options.AddPolicy(name: "AllowOrigin",
                    builder =>
                    {
                        //            builder
                        //.SetIsOriginAllowedToAllowWildcardSubdomains()
                        //.WithOrigins("http://localhost", "http://localhost:4200", "http://localhost:64448", "https://*.conedison.net")

                        //.AllowAnyMethod()
                        //.WithHeaders(HeaderNames.ContentType, "x-custom-header")
                        //.WithExposedHeaders("content-disposition")
                        ////.AllowAnyHeader()
                        //.AllowCredentials()
                        //.SetPreflightMaxAge(TimeSpan.FromSeconds(3600));
                        builder
                        .SetIsOriginAllowedToAllowWildcardSubdomains()
                        .WithOrigins("http://localhost", "http://localhost:4200", "http://localhost:64448", "https://*.conedison.net")
                        //.AllowAnyHeader()
                        .AllowCredentials()
                        .WithHeaders(HeaderNames.ContentType, "x-custom-header")
                        .AllowAnyMethod()
                        .WithExposedHeaders(HeaderNames.ContentType, "x-custom-header")

                        //   .WithMethods("PUT", "DELETE", "GET", "OPTIONS")
                        //.SetIsOriginAllowed(host => true)
                        ;
                    });
            });

            // Compressed responses over secure connections can be controlled with the EnableForHttps option, which is disabled by default because of the security risk.
            services.AddResponseCompression(options =>
            {
                options.EnableForHttps = true;
                options.Providers.Add<GzipCompressionProvider>();
            });
            
            services.AddHttpContextAccessor();
            
            GlobalVars.secret_key = Configuration.GetValue<string>("key");

            string egis_db = Configuration.GetConnectionString("egis_db");
            string uft_db = Configuration.GetConnectionString("uft_db");
            string maps_db = Configuration.GetConnectionString("maps_db");
            string microstation_db = Configuration.GetConnectionString("microstation_db");
            egis_db = Security.Decrypt(egis_db);
            uft_db = Security.Decrypt(uft_db);
            maps_db = Security.Decrypt(maps_db);
            microstation_db = Security.Decrypt(microstation_db);
            GlobalVars.egis_db = egis_db;
            GlobalVars.uft_db = uft_db;
            GlobalVars.maps_db = maps_db;
            GlobalVars.microstation_db = microstation_db;
            services.AddDbContext<EgisDBContext>(options => options.UseOracle(egis_db));
            services.AddDbContext<UFTDBContext>(options => options.UseOracle(uft_db));
            services.AddDbContext<MapsDBContext>(options => options.UseOracle(maps_db));
            services.AddDbContext<MicrostationDBContext>(options => options.UseOracle(microstation_db));
            GlobalVars.OPS_AD_Groups = Configuration.GetValue<string>("OPS_AD_Groups");
            GlobalVars.Non_Ops_AD_Grooups = Configuration.GetValue<string>("Non_Ops_AD_Groups");
            GlobalVars.App_AD_Group = Configuration.GetValue<string>("App_AD_Group");            
            GlobalVars.Consider_AD_Group = Configuration.GetValue<bool>("Consider_AD_Group");
            GlobalVars.environment = Configuration.GetValue<string>("Environment");
            GlobalVars.serverName = Configuration.GetValue<string>("Server");
            GlobalVars.appName = Configuration.GetValue<string>("App_name");
            GlobalVars.PDF_File_Path = Configuration.GetValue<string>("PDF_File_Path");
            GlobalVars.Maps_Schema_Name = Configuration.GetValue<string>("Maps_Schema_Name");
            GlobalVars.eGIS_Schema_Name = Configuration.GetValue<string>("eGIS_Schema_Name");
            GlobalVars.UFT_Schema_Name = Configuration.GetValue<string>("UFT_Schema_Name");
            GlobalVars.Microstation_Schema_Name = Configuration.GetValue<string>("Microstation_Schema_Name");
            GlobalVars.Default_Page_Size = Configuration.GetValue<string>("Default_Page_Size");
            services.AddAutoMapper(cfg => {
                cfg.AddProfile<MappingProfile>();
            });
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "MAPSAPI", Version = "v1" });
            });
            services.AddAuthentication(NegotiateDefaults.AuthenticationScheme).AddNegotiate();

            //services.AddAuthorization(options =>
            //{
            //    options.FallbackPolicy = options.DefaultPolicy;
            //});
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            app.UseOptions();

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseSwagger();
                app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "MAPSAPI v1"));
            }
            else
            {
                app.UseSwagger();
                app.UseSwaggerUI(c => c.SwaggerEndpoint("../swagger/v1/swagger.json", "MAPSAPI v1"));
            }

            app.UseHttpsRedirection();

            app.UseRouting();
            app.UseCors("AllowOrigin");
            
            app.UseAuthentication();
            app.UseAuthorization();
            
            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers().RequireCors("AllowOrigin");
            });
            app.UseResponseCompression();
        }
    }
}
