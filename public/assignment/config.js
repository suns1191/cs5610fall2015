(function() {
    angular
        .module("FormBuilderApp")
        .config(function($routeProvider)
        {
            $routeProvider
                .when("/home",
                {
                    templateUrl: "home/home.view.html"
                })
                .when("/login",
                {
                    templateUrl: "login/login.view.html",
                    controller: "LoginController"
                })
                .when("/register",
                {
                    templateUrl: "register/register.view.html",
                    controller: "RegisterController"
                })
                .when("/profile",
                {
                    templateUrl: "profile/profile.view.html",
                    controller: "ProfileController"
                })
                .when("/forms",
                {
                    templateUrl: "form/form.view.html",
                    controller: "FormController"
                })
                .when("/", {
                    redirectTo : "/home"
                })
                .otherwise({
                    redirectTo: "/"
                });
        });
})();
