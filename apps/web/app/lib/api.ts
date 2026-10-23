const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export type ApiError = Error & {
    status : number
}
export function apiError(status : number , message : string) :ApiError {
    const error = new Error(message) as ApiError;
    error.name = "ApiError";
    error.status = status;
    return error;
}

export function isAuthError(err: unknown): boolean {
    return (
        err instanceof Error &&
        err.name === "ApiError" &&
        "status" in err &&
        (err as ApiError).status === 401
    )
}

export function getToken() : string | null {
    if(typeof window === "undefined") return null;
    return localStorage.getItem('token')
}

export function setToken(token : string) : void {
    if(typeof window === "undefined") return ;
    return localStorage.setItem('token' , token)
}

export function removeToken() : void {
    if(typeof window === "undefined") return ;
    localStorage.removeItem('token')
}

export function logout() : void {
    removeToken();
    if(typeof window !== "undefined") {
         window.location.href = "/login"
    }
}


export async function  apiFetch(path : string , options : RequestInit = {}) {
    const token  = getToken();
    console.log("token ", token)

    const res = await fetch(`${BASE_URL}${path}` ,  {
        ...options,
        headers : {
            'Content-Type' : 'application/json',
            ...(token ? {Authorization : `Bearer ${token}`} : {}),
            ...options.headers,
        },
    });

    const data = await res.json().catch(() => ({}));

    if(!res.ok) {
        throw apiError(res.status, data?.error ?? data?.message ?? res.statusText ?? "Request failed");
    }

    return data;
}

export async function signup(name : string , email : string, password : string) {
    const data = await apiFetch("/auth/signup", {
        method : 'POST',
        body : JSON.stringify({name , email , password})
    });
    if(data.token)  setToken(data.token);
    return data;
}

export async function login(email: string, password: string) {
    const data = await apiFetch("/auth/login", {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    if (data.token) setToken(data.token);
    return data;
}

export async function  getMe() {
    return apiFetch('/auth/me')
}


export async function getProjects() {
   const data = await apiFetch("/projects")
   return data.projects ?? []
}

export async function createProject(prompt : string) {
    return apiFetch("/projects" ,  {
        method : 'POST',
        body : JSON.stringify({prompt})
    })
}

export async function deleteProject(id : string) {
    return apiFetch(`/projects/${id}` , {
        method : 'DELETE',
    })
}

export async function getFiles(projectId : string) {
    return apiFetch(`/projects/${projectId}/files`)
}

export async function upsertFile(projectId : string, path : string , content : string) {
    return apiFetch(`/projects/${projectId}/files` ,  {
        method : 'PUT',
        body : JSON.stringify({projectId , path , content})
    })
}

export async function deleteFile(projectId : string, path : string) {
    return apiFetch(`/projects/${projectId}/files`, {
        method : 'DELETE',
        body : JSON.stringify({path})
    })
}

export async function getMessages(projectId : string) {
    return apiFetch(`/projects/${projectId}/messages`)
}

export async function sendMessages(projectId : string, message : string) {
    return apiFetch(`/projects/${projectId}/messages` , {
        method : 'POST',
        body : JSON.stringify({projectId ,message})
    })
}

export async function startSandbox(projectId: string) {
    return apiFetch(`/projects/${projectId}/start`, {
        method: 'POST',
    });
}

export async function cancelMessage(projectId : string) {
    return apiFetch(`/projects/${projectId}/cancel` , {
        method : "POST"
    });
}



