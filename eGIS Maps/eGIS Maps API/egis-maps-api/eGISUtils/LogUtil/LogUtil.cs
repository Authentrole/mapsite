using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using log4net;

namespace eGIS.Util
{
    public class Logger
    {
        private static log4net.ILog oLogger = null;


        #region Properties
        /// <summary>
        /// Gets the instance.
        /// </summary>
        /// <value>
        /// The instance.
        /// </value>
        private static ILog Instance
        {
            get
            {
                if (oLogger == null)
                {
                    log4net.Config.XmlConfigurator.Configure();
                    oLogger = log4net.LogManager.GetLogger("CommonLogger");

                }

                return oLogger;
            }
        }
        #endregion




        #region Public Methods</pre>

        public static bool IsDebugEnabled()
        {
            return Logger.Instance.IsDebugEnabled;
        }//public static bool IsDebugEnabled()


        public static bool IsErrorEnabled()
        {
            return Logger.Instance.IsErrorEnabled;
        }//public static bool IsErrorEnabled()

        public static bool IsFatalEnabled()
        {
            return Logger.Instance.IsFatalEnabled;
        }//public static bool IsFatalEnabled()

        public static bool IsInfoEnabled()
        {
            return Logger.Instance.IsInfoEnabled;
        }//public static bool IsInfoEnabled()


        public static bool IsWarnEnabled()
        {
            return Logger.Instance.IsWarnEnabled;
        }//public static bool IsDebugEnabled()







        /// <summary>
        /// Log a message object with the log4net.Core.Level.Debug level.
        /// </summary>
        /// <param name="message">The message.</param>
        public static void Debug(object message)
        {
            Logger.Debug(message, 0);
        }
        public static void Debug(object message, int indent)
        {
            Logger.Instance.Debug(Logger.getIndentString(indent) + message);
        }

        /// <summary>
        /// Logs a message object with the log4net.Core.Level.Info level.
        /// </summary>
        /// <param name="message">The message.</param>
        public static void Info(object message)
        {
            Logger.Info(message, 0);
        }
        public static void Info(object message, int indent)
        {
            Logger.Instance.Info(Logger.getIndentString(indent) + message);
        }

        /// <summary>
        /// Logs a message object with the log4net.Core.Level.Info Warning.
        /// </summary>
        /// <param name="message">The message.</param>
        public static void Warn(object message)
        {
            Logger.Warn(message, 0);
        }
        public static void Warn(object message, int indent)
        {
            Logger.Instance.Warn(Logger.getIndentString(indent) + message);
        }


        /// <summary>
        /// Logs a message object with the log4net.Core.Level.Error level.
        /// </summary>
        /// <param name="message">The message.</param>
        public static void Error(string message)
        {
            Logger.Error(message, 0);
        }
        public static void Error(object message, int indent)
        {
            Logger.Instance.Error(Logger.getIndentString(indent) + message);
        }

        /// <summary>
        /// Log a exception with the log4net.Core.Level.Fatal level.
        /// </summary>
        /// <param name="ex">The ex.</param>
        public static void Error(Exception ex)
        {
            Logger.Instance.Error(ex);
        }

        /// <summary>
        /// Log a message object with the log4net.Core.Level.Error level including the
        /// </summary>
        /// <param name="message">The message.</param>
        /// <param name="exception">The exception.</param>
        public static void Error(object message, Exception exception)
        {
            Logger.Instance.Error(message, exception);
        }

        /// <summary>
        /// Log a message object with the log4net.Core.Level.Fatal level.
        /// </summary>
        /// <param name="message">The message.</param>
        public static void Fatal(string message)
        {
            Logger.Fatal(message, 0);
        }
        public static void Fatal(object message, int indent)
        {
            Logger.Instance.Fatal(Logger.getIndentString(indent) + message);
        }


        /// <summary>
        /// Log a exception with the log4net.Core.Level.Fatal level.
        /// </summary>
        /// <param name="ex">The ex.</param>
        public static void Fatal(Exception ex)
        {
            Logger.Instance.Fatal(ex);
        }

        /// <summary>
        /// Log a message object with the log4net.Core.Level.Fatal level including the
        // stack trace of the System.Exception passed as a parameter.
        /// </summary>
        /// <param name="message">The message.</param>
        /// <param name="exception">The exception.</param>
        public static void Fatal(object message, Exception exception)
        {
            Logger.Instance.Fatal(message, exception);
        }
        #endregion

        private static string getIndentString(int iTabCnt)
        {
            string sTab = string.Empty;
            for (int i = 0; i < iTabCnt; i++)
            {
                sTab += "\t";
            }
            return sTab;
        }//private string getIndentString(int iTabCnt)

    }//public class LogUtil


}//namespace eGIS.Util
