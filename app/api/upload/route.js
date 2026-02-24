export async function POST(req) {
  console.log("API UPLOAD APPELÉ");

  return new Response(
    JSON.stringify({ message: "API OK" }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
