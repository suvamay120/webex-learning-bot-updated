import axios from 'axios';

export async function sendWebexMessage(toEmail, text, token, apiUrl) {
  const response = await axios.post(apiUrl, {
    toPersonEmail: toEmail,
    text
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return { id: response.data.id };
}