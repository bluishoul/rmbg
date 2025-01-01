const getImageMatting = async (token: string, file: Blob) => {
  if (!token) return "";

  const formData = new FormData();
  formData.append("image", file);
  formData.append("model", "RMBG-2.0");
  formData.append("response_format", "b64_json");
  const resp = await fetch("https://ai.gitee.com/v1/images/mattings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await resp.json();
  return `data:image/png;base64,${data.data[0].b64_json}`;
};

export default getImageMatting;
