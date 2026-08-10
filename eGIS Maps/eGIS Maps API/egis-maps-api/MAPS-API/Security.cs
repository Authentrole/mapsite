using System;
using System.Security.Cryptography;
using System.Text;

namespace MapsAPI
{
    class Security
    {
        private static byte[] GetKeyBytes()
        {
            using var sha = SHA256.Create();
            return sha.ComputeHash(Encoding.UTF8.GetBytes(GlobalVars.secret_key));
        }

        public static string Encrypt(string textToEncrypt)
        {
            if (string.IsNullOrEmpty(textToEncrypt))
                return textToEncrypt;

            using var aes = Aes.Create();
            aes.Key = GetKeyBytes();
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            aes.GenerateIV();

            using var encryptor = aes.CreateEncryptor();
            byte[] plainBytes = Encoding.UTF8.GetBytes(textToEncrypt);
            byte[] cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

            byte[] result = new byte[aes.IV.Length + cipherBytes.Length];
            Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
            Buffer.BlockCopy(cipherBytes, 0, result, aes.IV.Length, cipherBytes.Length);

            return Convert.ToBase64String(result);
        }

        public static string Decrypt(string textToDecrypt)
        {
            if (string.IsNullOrEmpty(textToDecrypt))
                return textToDecrypt;

            byte[] inputBytes = Convert.FromBase64String(textToDecrypt);

            if (inputBytes.Length < 16)
            {
                throw new ArgumentException(
                    "Encrypted value is too short to contain an IV.",
                    nameof(textToDecrypt));
            }

            using var aes = Aes.Create();
            aes.Key = GetKeyBytes();
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            byte[] iv = new byte[16];
            byte[] cipherBytes = new byte[inputBytes.Length - 16];
            Buffer.BlockCopy(inputBytes, 0, iv, 0, 16);
            Buffer.BlockCopy(inputBytes, 16, cipherBytes, 0, cipherBytes.Length);
            aes.IV = iv;

            using var decryptor = aes.CreateDecryptor();
            byte[] plainBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);

            return Encoding.UTF8.GetString(plainBytes);
        }
    }
}
